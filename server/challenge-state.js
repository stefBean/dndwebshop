import { openDatabase } from './db.js';

const [id, active] = process.argv.slice(2);
if (!['weak-password', 'log-flood'].includes(id) || !['true', 'false'].includes(active)) {
  console.error('Usage: npm run challenge:set -- <weak-password|log-flood> <true|false>');
  process.exitCode = 1;
} else {
  const db = openDatabase();
  try {
    db.prepare('UPDATE challenges SET active = ? WHERE id = ?').run(Number(active === 'true'), id);
    console.log(`${id}: active=${active}. Production always uses safe behavior.`);
  } finally {
    db.close();
  }
}
