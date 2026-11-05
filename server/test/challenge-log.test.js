import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import express from 'express';
import { createChallengeLog, createChallengeRouter } from '../challenge-log.js';

const runFile = promisify(execFile);

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dice-lore-log-missing-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

test('status returns an empty unsolved state before the first log entry', async (t) => {
  const directory = await temporaryDirectory(t);
  const logPath = path.join(directory, 'not-created', 'app.log');
  const app = express();
  app.use(createChallengeRouter({ logPath, adminToken: '', isActive: () => true }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const url of ['/api/challenges/log-flood/status', '/api/challenges/log-flood/reset']) {
    const response = await fetch(base + url, { method: url.endsWith('/reset') ? 'POST' : 'GET' });
    assert.equal(response.status, 200);
    const status = await response.json();
    assert.equal(status.sizeBytes, 0);
    assert.equal(status.achieved, false);
  }
  const response = await fetch(base + '/api/log.flood', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'small test entry' }),
  });
  assert.equal(response.status, 200);
  assert.ok((await response.json()).sizeBytes > 0);
  assert.match(await readFile(logPath, 'utf8'), /small test entry/);
});

test('reset command succeeds repeatedly without an existing log file', async (t) => {
  const directory = await temporaryDirectory(t);
  const logPath = path.join(directory, 'not-created', 'app.log');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { stdout } = await runFile(process.execPath, ['reset-challenge.js'], {
      cwd: path.resolve(import.meta.dirname, '..'),
      env: { ...process.env, CHALLENGE_LOG_PATH: logPath },
    });
    assert.match(stdout, /0 bytes/);
  }
});

test('status and reset preserve errors other than a missing file', async (t) => {
  const directory = await temporaryDirectory(t);
  const log = createChallengeLog({ logPath: path.join(directory, 'invalid\0', 'app.log') });
  await assert.rejects(log.status(), { code: 'ERR_INVALID_ARG_VALUE' });
  await assert.rejects(log.reset(), { code: 'ERR_INVALID_ARG_VALUE' });
});