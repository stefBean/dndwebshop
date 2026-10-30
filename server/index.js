import { createApp } from './app.js';
import { openDatabase } from './db.js';

const db = openDatabase();
const port = process.env.PORT || 3001;
const server = createApp(db).listen(port, (error) => {
  if (error) {
    console.error(`Could not start the API on port ${port}: ${error.message}`);
    db.close();
    process.exitCode = 1;
    return;
  }
  console.log(`Dungeon & Dragons online shop ${port}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
