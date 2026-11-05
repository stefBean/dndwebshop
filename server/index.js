import { createApp } from './app.js';
import { openDatabase, resolveDatabasePath } from './db.js';
import { acquireRuntimeLock } from './runtime-lock.js';

const release = acquireRuntimeLock(resolveDatabasePath());
process.on('exit', release);
const db = openDatabase();
const port = process.env.PORT || 3001;
const server = createApp(db).listen(port, (error) => {
  if (error) {
    console.error(`Could not start the API on port ${port}: ${error.message}`);
    db.close();
    process.exitCode = 1;
    return;
  }
  console.log(`Dungeons & Dragons Shop on port ${port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
