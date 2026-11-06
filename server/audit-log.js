import express from 'express';
import { appendFile, mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_LOG_PATH = '/tmp/dice-lore-audit/app.log';
export const THRESHOLD_BYTES = 10 * 1024 * 1024; // goal: > 10 MB
const ACTIVE_LIMIT = 32 * 1024 * 1024;
const SAFE_LIMIT = 64 * 1024;

async function fileSize(file) {
  try {
    return (await stat(file)).size;
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }
}

export function createAuditLog({
  logPath = process.env.AUDIT_LOG_PATH || DEFAULT_LOG_PATH,
  challenges = { isActive: () => false },
} = {}) {
  const directory = path.dirname(logPath);
  let queue = Promise.resolve();
  let solved = false;

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
      isActive: challenges.isActive('log-flood'),
      sizeBytes,
      thresholdBytes: THRESHOLD_BYTES,
      achieved: sizeBytes >= THRESHOLD_BYTES,
    };
  }

  function write(req, response) {
    return enqueue(async () => {
      await mkdir(directory, { recursive: true });
      const active = challenges.isActive('log-flood');
      const entry = {
        time: new Date().toISOString(),
        method: req.method,
        url: active ? req.originalUrl : req.path.slice(0, 200),
        ip: req.ip,
        ...(active ? { headers: req.headers, response } : {}),
      };
      const line = `${JSON.stringify(entry)}\n`;
      const limit = active ? ACTIVE_LIMIT : SAFE_LIMIT;
      let completed = false;
      const sizeBefore = await fileSize(logPath);
      if (active && !solved && sizeBefore >= THRESHOLD_BYTES) {
        solved = true;
        completed = true;
      }
      if (sizeBefore + Buffer.byteLength(line) > limit) {
        if (active) return { written: false, reason: 'full', completed };
        await writeFile(logPath, '');
      }
      await appendFile(logPath, line);
      const sizeBytes = await fileSize(logPath);
      if (active && !solved && sizeBytes >= THRESHOLD_BYTES) {
        solved = true;
        completed = true;
        console.log(`\n*** AUDIT LOG GOAL REACHED: ${sizeBytes} bytes (>= 10 MB) ***\n`);
      }
      return { written: true, reason: null, completed };
    });
  }

  function reset() {
    return enqueue(async () => {
      await mkdir(directory, { recursive: true });
      await writeFile(logPath, '');
      solved = false;
      return status();
    });
  }

  return { logPath, status, write, reset };
}

export function createAuditRouter(options = {}) {
  const log = options.log || createAuditLog(options);
  const onReset = options.onReset || (() => 0);
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const resetToken = options.resetToken ?? process.env.CHALLENGE_RESET_TOKEN ?? '';
  const router = express.Router();

  router.get('/api/audit-log/status', async (req, res) => res.json(await log.status()));

  router.post('/api/audit-log/reset', async (req, res, next) => {
    if (production && (!resetToken || req.get('x-challenge-reset-token') !== resetToken)) {
      return res.status(403).json({ error: 'A valid challenge reset token is required.' });
    }
    if (resetToken && req.get('x-challenge-reset-token') !== resetToken) {
      return res.status(403).json({ error: 'A valid challenge reset token is required.' });
    }
    try {
      const deletedUsers = await onReset();
      const status = await log.reset();
      return res.json({ reset: true, deletedUsers, ...status });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
