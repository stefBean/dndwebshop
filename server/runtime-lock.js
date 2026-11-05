import { openSync, closeSync, unlinkSync } from 'node:fs';

// Shared by the running shop and the operator reset. Never guess whether a lock
// from another container/process is stale. Recovery requires a stopped service.
export function acquireRuntimeLock(databasePath) {
  const filename = databasePath + '.operator.lock';
  let descriptor;
  try { descriptor = openSync(filename, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Shop/reset lock exists. Stop the shop before resetting. See README for stale-lock recovery.');
    throw error;
  }
  let released = false;
  return () => { if (!released) { released = true; closeSync(descriptor); unlinkSync(filename); } };
}
