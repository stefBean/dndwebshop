import express from 'express';
import { appendFile, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * CWE-779 / OWASP A09:2025 "Logging of Excessive Data" challenge.
 *
 * Active mode intentionally logs full headers and bodies in an isolated file.
 * Inactive mode limits bodies and request frequency, records metadata only,
 * and rotates the file. Both modes enforce a storage cap.
 */

export const DEFAULT_LOG_PATH = '/tmp/dice-lore-challenge/app.log';
export const DEFAULT_THRESHOLD_BYTES = 10 * 1024 * 1024; // challenge goal: > 10 MB
export const BODY_LIMIT = '1mb';

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function fileSize(file) {
  try {
    return (await stat(file)).size;
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}

export function createChallengeLog({
  logPath = process.env.CHALLENGE_LOG_PATH || DEFAULT_LOG_PATH,
  thresholdBytes = positiveNumber(process.env.CHALLENGE_LOG_THRESHOLD_BYTES, DEFAULT_THRESHOLD_BYTES),
  adminToken = process.env.CHALLENGE_ADMIN_TOKEN || '',
  now = () => Date.now(),
  isActive = () => false,
} = {}) {
  const directory = path.dirname(logPath);
  let queue = Promise.resolve();

  // Serialize writes so concurrent requests cannot interleave log lines.
  function enqueue(task) {
    const run = queue.then(task, task);
    queue = run.catch(() => {});
    return run;
  }

  async function status() {
    const sizeBytes = await fileSize(logPath);
    return {
      logPath,
      isActive: isActive(),
      sizeBytes,
      thresholdBytes,
      achieved: sizeBytes >= thresholdBytes,
    };
  }

  /**
   * Active mode intentionally includes credentials and bodies for the exercise.
   * Safe mode records bounded metadata without query strings or credentials.
   */
  function write(req) {
    return enqueue(async () => {
      await mkdir(directory, { recursive: true });
      const active = isActive();
      const entry = {
        time: new Date(now()).toISOString(),
        method: req.method,
        url: active ? req.originalUrl : req.path.slice(0, 200),
        ip: req.ip,
        ...(active ? { headers: req.headers, body: req.body } : {}),
      };
      const line = `${JSON.stringify(entry)}\n`;
      const limit = active ? 32 * 1024 * 1024 : 64 * 1024;
      if ((await fileSize(logPath)) + Buffer.byteLength(line) > limit) {
        if (active) throw Object.assign(new Error('The challenge log is full. Reset it before continuing.'), { status: 507 });
        await writeFile(logPath, '');
      }
      await appendFile(logPath, line);
    });
  }

  function reset() {
    return enqueue(async () => {
      await mkdir(directory, { recursive: true });
      await writeFile(logPath, '');
      return status();
    });
  }

  return { logPath, thresholdBytes, adminToken, status, write, reset };
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
 * larger body without weakening the rest of the API.
 */
export function createChallengeRouter(options = {}) {
  const log = createChallengeLog(options);
  const router = express.Router();
  const isActive = options.isActive || (() => false);
  const safeParser = express.json({ limit: '10kb' });
  const challengeParser = express.json({ limit: BODY_LIMIT });
  const attempts = new Map();
  const now = options.now || Date.now;
  const parse = (req, res, next) => (isActive() ? challengeParser : safeParser)(req, res, next);
  const rateLimit = (req, res, next) => {
    if (isActive()) return next();
    const time = now();
    for (const [key, value] of attempts) if (value.until <= time) attempts.delete(key);
    const entry = attempts.get(req.ip) || { count: 0, until: time + 60000 };
    if (entry.count >= 30) {
      res.set('Retry-After', String(Math.ceil((entry.until - time) / 1000)));
      return res.status(429).json({ error: 'Too many log requests. Try again later.' });
    }
    if (attempts.size >= 10000) attempts.delete(attempts.keys().next().value);
    attempts.set(req.ip, entry);
    entry.count += 1;
    next();
  };

  router.post('/api/log.flood', rateLimit, parse, async (req, res) => {
    await log.write(req);
    res.json({ logged: true, sizeBytes: (await log.status()).sizeBytes });
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
