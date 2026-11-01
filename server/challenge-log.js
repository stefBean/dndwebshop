import express from 'express';
import { appendFile, mkdir, stat, truncate } from 'node:fs/promises';
import path from 'node:path';

/**
 * CWE-779 / OWASP A09:2025 "Logging of Excessive Data" challenge.
 *
 * This module is intentionally vulnerable and isolated from the normal shop
 * logging: every request to the challenge endpoint is written to a dedicated
 * log file with all headers and the complete body, without truncation,
 * redaction, rate limiting or rotation.
 */

export const DEFAULT_LOG_PATH = '/tmp/dice-lore-challenge/app.log';
export const DEFAULT_THRESHOLD_BYTES = 10 * 1024 * 1024; // challenge goal: > 10 MB
export const BODY_LIMIT = '1mb';

function positiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function fileSize(file) {
  const info = await stat(file, { throwIfNoEntry: false });
  return info?.size ?? 0;
}

export function createChallengeLog({
  logPath = process.env.CHALLENGE_LOG_PATH || DEFAULT_LOG_PATH,
  thresholdBytes = positiveNumber(process.env.CHALLENGE_LOG_THRESHOLD_BYTES, DEFAULT_THRESHOLD_BYTES),
  adminToken = process.env.CHALLENGE_ADMIN_TOKEN || '',
  now = () => Date.now(),
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
      sizeBytes,
      thresholdBytes,
      achieved: sizeBytes >= thresholdBytes,
    };
  }

  /**
   * Intentionally unsafe: writes the complete request, including cookies,
   * authorization headers and the full body, with no size or count limit.
   */
  function write(req) {
    return enqueue(async () => {
      await mkdir(directory, { recursive: true });
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

  function reset() {
    return enqueue(async () => {
      await mkdir(directory, { recursive: true });
      await truncate(logPath, 0);
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

  router.post('/api/log.flood', express.json({ limit: BODY_LIMIT }), async (req, res) => {
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
