import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vite = path.join(root, 'client/node_modules/vite/bin/vite.js');

if (!existsSync(vite) || !existsSync(path.join(root, 'server/node_modules/express/package.json'))) {
  console.error('Install dependencies first: npm ci --prefix client && npm ci --prefix server (from the repository root).');
  process.exit(1);
}

const children = new Set();
let stopping = false;
let exitCode = 0;
let forceTimer;

function stop(code) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
  forceTimer = setTimeout(() => {
    for (const child of children) child.kill('SIGKILL');
  }, 5000);
  forceTimer.unref();
}

function start(name, args, cwd) {
  // Launch Node directly so cleanup includes both services without npm/shell grandchildren.
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit' });
  children.add(child);
  child.on('error', (error) => {
    console.error(`[dev] Could not start ${name}: ${error.message}`);
    stop(1);
  });
  child.on('close', (code, signal) => {
    children.delete(child);
    if (!stopping) {
      console.error(`[dev] ${name} stopped${signal ? ` (${signal})` : ''}; stopping both services.`);
      stop(code || 1);
    }
    if (children.size === 0) {
      clearTimeout(forceTimer);
      process.exitCode = exitCode;
    }
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

console.log(`[dev] Starting the API on port ${process.env.PORT || 3001} and Vite. Press Ctrl+C to stop both.`);
start('API', [path.join(root, 'server/index.js')], path.join(root, 'server'));
start('Frontend', [vite, '--strictPort', ...process.argv.slice(2)], path.join(root, 'client'));
