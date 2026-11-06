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
      if ((await fileSize(logPath)) + Buffer.byteLength(line) > limit) {
        if (active) return { written: false, reason: 'full' };
        await writeFile(logPath, '');
      }
      await appendFile(logPath, line);
      const sizeBytes = await fileSize(logPath);
      if (!solved && sizeBytes >= THRESHOLD_BYTES) {
        solved = true;
        console.log(`\n*** AUDIT LOG GOAL REACHED: ${sizeBytes} bytes (>= 10 MB) ***\n`);
      }
      return { written: true, reason: null };
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
  const router = express.Router();

  router.get('/api/audit-log/status', async (req, res) => res.json(await log.status()));

  router.post('/api/audit-log/reset', async (req, res) => {
    res.json({ reset: true, ...(await log.reset()) });
  });

  return router;
}
