import { createApp } from './app.js';
import { openDatabase } from './db.js';

const db = openDatabase();
const port = process.env.PORT || 3001;
const server = createApp(db).listen(port, () => console.log(`Dice & Lore on port ${port}`));

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
