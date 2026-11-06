import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import express from 'express';
import { createAuditLog, createAuditRouter } from '../audit-log.js';

const runFile = promisify(execFile);

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dice-lore-log-missing-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('status returns an empty unsolved state before the first log entry', async (t) => {
  const directory = await temporaryDirectory(t);
  const logPath = path.join(directory, 'not-created', 'app.log');
  const log = createAuditLog({ logPath, challenges: { isActive: () => true } });
  const app = express();
  app.use(createAuditRouter({ log }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const url of ['/api/audit-log/status', '/api/audit-log/reset']) {
    const response = await fetch(base + url, { method: url.endsWith('/reset') ? 'POST' : 'GET' });
    assert.equal(response.status, 200);
    const status = await response.json();
    assert.equal(status.sizeBytes, 0);
    assert.equal(status.achieved, false);
  }
  const result = await log.write(
    { method: 'GET', originalUrl: '/api/products', path: '/api/products', ip: '127.0.0.1', headers: {} },
    [{ name: 'Dragon Sword' }],
  );
  assert.deepEqual(result, { written: true, reason: null });
  assert.match(await readFile(logPath, 'utf8'), /Dragon Sword/);
  assert.ok((await log.status()).sizeBytes > 0);
});

test('reset command succeeds repeatedly without an existing log file', async (t) => {
  const directory = await temporaryDirectory(t);
  const logPath = path.join(directory, 'not-created', 'app.log');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { stdout } = await runFile(process.execPath, ['reset-audit-log.js'], {
      cwd: path.resolve(import.meta.dirname, '..'),
      env: { ...process.env, AUDIT_LOG_PATH: logPath },
    });
    assert.match(stdout, /0 bytes/);
  }
});

test('status and reset preserve errors other than a missing file', async (t) => {
  const directory = await temporaryDirectory(t);
  const log = createAuditLog({ logPath: path.join(directory, 'invalid\0', 'app.log'), challenges: { isActive: () => false } });
  await assert.rejects(log.status(), { code: 'ERR_INVALID_ARG_VALUE' });
  await assert.rejects(log.reset(), { code: 'ERR_INVALID_ARG_VALUE' });
});