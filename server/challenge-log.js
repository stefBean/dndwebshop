import express from 'express';
import { hash } from 'node:crypto';
import {
  appendFile,
  mkdir,
  readdir,
  rename,
  stat,
  truncate,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';

/**
 * CWE-779 / OWASP A09:2025 "Logging of Excessive Data" challenge.
 *
 * The challenge is intentionally isolated from the normal shop logging:
 *  - `vulnerable` mode logs every header and the complete request body,
 *    without truncation, redaction, rate limiting or rotation.
 *  - `secure` mode logs only short structured metadata, rejects oversized
 *    bodies, rate limits the endpoint and rotates the log file.
 *  - `off` mode does not mount the challenge routes at all.
 */

export const DEFAULT_LOG_PATH = '/tmp/dice-lore-challenge/app.log';
export const DEFAULT_MAX_BYTES = 32 * 1024 * 1024; // 32 MiB tmpfs budget
export const DEFAULT_THRESHOLD_BYTES = 10 * 1024 * 1024; // challenge goal: > 10 MB
export const DEFAULT_ROTATE_KEEP = 3;
export const SECURE_BODY_LIMIT = '10kb';
export const VULNERABLE_BODY_LIMIT = '1mb';
export const SECURE_RATE_LIMIT = 30;
export const SECURE_RATE_WINDOW_MS = 60 * 1000;

const OFF_VALUES = new Set(['off', '0', 'false', 'disabled', 'no']);
const SECURE_VALUES = new Set(['secure', 'fixed', 'patched', 'safe']);
const VULNERABLE_VALUES = new Set(['vulnerable', 'on', '1', 'true', 'enabled', 'yes']);

/**
 * Resolve the challenge mode from the environment.
 * Defaults to `vulnerable` outside production and `off` in production so a
 * deployed shop never exposes the intentionally weak logger by accident.
 */
export function resolveChallengeMode({ env = process.env, production = env.NODE_ENV === 'production' } = {}) {
  const raw = String(env.CHALLENGE_LOG_FLOOD ?? '').trim().toLowerCase();
  if (OFF_VALUES.has(raw)) return 'off';
  if (SECURE_VALUES.has(raw)) return 'secure';
  if (VULNERABLE_VALUES.has(raw)) return 'vulnerable';
  return production ? 'off' : 'vulnerable';
}

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

// One-shot hashing API (Node >= 20.12 / 21.7). Only a short, non-reversible
// fingerprint of the client address is ever persisted in secure mode.
const hashIp = (ip) => hash('sha256', String(ip ?? 'unknown'), 'hex').slice(0, 12);

async function fileSize(file) {
  const info = await stat(file, { throwIfNoEntry: false });
  return info?.size ?? 0;
}

async function exists(file) {
  return (await stat(file, { throwIfNoEntry: false })) !== undefined;
}

async function removeIfExists(file) {
  try {
    await unlink(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function createChallengeLog({
  mode = 'vulnerable',
  logPath = process.env.CHALLENGE_LOG_PATH || DEFAULT_LOG_PATH,
  maxBytes = positiveNumber(process.env.CHALLENGE_LOG_MAX_BYTES, DEFAULT_MAX_BYTES),
  thresholdBytes = positiveNumber(process.env.CHALLENGE_LOG_THRESHOLD_BYTES, DEFAULT_THRESHOLD_BYTES),
  rotateKeep = DEFAULT_ROTATE_KEEP,
  adminToken = process.env.CHALLENGE_ADMIN_TOKEN || '',
  now = () => Date.now(),
} = {}) {
  const directory = path.dirname(logPath);
  const hits = new Map();
  let queue = Promise.resolve();

  // Serialize every filesystem mutation so rotation and appends stay ordered.
  function enqueue(task) {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  }

  const ensureDirectory = () => mkdir(directory, { recursive: true });

  async function rotatedFiles() {
    try {
      const names = await readdir(directory);
      return names.filter((name) => name.startsWith(`${path.basename(logPath)}.`)).length;
    } catch {
      return 0;
    }
  }

  async function status() {
    const sizeBytes = await fileSize(logPath);
    return {
      mode,
      logPath,
      sizeBytes,
      limitBytes: maxBytes,
      thresholdBytes,
      achieved: sizeBytes >= thresholdBytes,
      enforced: mode === 'secure',
      rotatedFiles: await rotatedFiles(),
    };
  }

  async function rotate() {
    await removeIfExists(`${logPath}.${rotateKeep}`);
    for (let index = rotateKeep - 1; index >= 1; index -= 1) {
      const from = `${logPath}.${index}`;
      if (await exists(from)) await rename(from, `${logPath}.${index + 1}`);
    }
    if (await exists(logPath)) await rename(logPath, `${logPath}.1`);
  }

  /**
   * Intentionally unsafe: writes the complete request, including cookies,
   * authorization headers and the full body, with no size or count limit.
   */
  function writeVulnerable(req) {
    return enqueue(async () => {
      await ensureDirectory();
      const entry = {
        time: new Date(now()).toISOString(),
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        headers: req.headers,
        body: req.body,
      };
      await appendFile(logPath, `${JSON.stringify(entry)}\n`);
    });
  }

  /**
   * Hardened: only short, structured metadata. No headers, cookies, tokens or
   * request bodies are written. The file is rotated before it exceeds maxBytes.
   */
  function writeSecure({ method, requestPath, statusCode, durationMs, bytes, ip }) {
    return enqueue(async () => {
      await ensureDirectory();
      const entry = {
        time: new Date(now()).toISOString(),
        method,
        path: String(requestPath ?? '').slice(0, 200),
        status: statusCode,
        durationMs,
        bytes,
        ipHash: hashIp(ip),
      };
      const line = `${JSON.stringify(entry)}\n`;
      if ((await fileSize(logPath)) + Buffer.byteLength(line) > maxBytes) await rotate();
      await appendFile(logPath, line);
    });
  }

  function allow(ip) {
    const timestamp = now();
    const key = String(ip ?? 'unknown');
    let entry = hits.get(key);
    if (!entry || entry.until <= timestamp) {
      if (hits.size >= 5000) hits.delete(hits.keys().next().value);
      entry = { count: 0, until: timestamp + SECURE_RATE_WINDOW_MS };
      hits.set(key, entry);
    }
    if (entry.count >= SECURE_RATE_LIMIT) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.until - timestamp) / 1000)) };
    }
    entry.count += 1;
    return { allowed: true };
  }

  function reset() {
    return enqueue(async () => {
      await ensureDirectory();
      if (await exists(logPath)) await truncate(logPath, 0);
      for (let index = 1; index <= rotateKeep; index += 1) {
        await removeIfExists(`${logPath}.${index}`);
      }
      hits.clear();
      return status();
    });
  }

  return { mode, logPath, maxBytes, thresholdBytes, adminToken, status, rotate, writeVulnerable, writeSecure, allow, reset };
}

function requireAdmin(log) {
  return (req, res, next) => {
    if (!log.adminToken) return next();
    if (req.get('x-challenge-token') === log.adminToken) return next();
    return res.status(403).json({ error: 'A valid challenge admin token is required.' });
  };
}

/**
 * Express router for the isolated challenge endpoints.
 * Mount this before the global JSON parser so the challenge can accept a
 * larger body in vulnerable mode without weakening the rest of the API.
 */
export function createChallengeRouter(options = {}) {
  const log = createChallengeLog(options);
  const router = express.Router();
  const bodyLimit = log.mode === 'secure' ? SECURE_BODY_LIMIT : VULNERABLE_BODY_LIMIT;

  router.post('/api/log.flood', express.json({ limit: bodyLimit }), async (req, res) => {
    const started = performance.now();
    if (log.mode === 'secure') {
      const decision = log.allow(req.ip);
      if (!decision.allowed) {
        res.set('Retry-After', String(decision.retryAfter));
        return res.status(429).json({ error: 'Too many challenge requests. Please try again later.' });
      }
      await log.writeSecure({
        method: req.method,
        requestPath: req.path,
        statusCode: 200,
        durationMs: Math.round((performance.now() - started) * 100) / 100,
        bytes: Number(req.get('content-length')) || 0,
        ip: req.ip,
      });
      return res.json({ logged: true, mode: log.mode, sizeBytes: (await log.status()).sizeBytes });
    }
    await log.writeVulnerable(req);
    return res.json({ logged: true, mode: log.mode, sizeBytes: (await log.status()).sizeBytes });
  });

  router.get('/api/challenges/log-flood/status', async (req, res) => res.json(await log.status()));

  router.post('/api/challenges/log-flood/reset', requireAdmin(log), async (req, res) => {
    res.json({ reset: true, ...(await log.reset()) });
  });

  router.use((error, req, res, next) => {
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'The challenge request body is too large.' });
    }
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'The request contains invalid JSON.' });
    }
    return next(error);
  });

  return router;
}
