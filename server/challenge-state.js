import Database from 'better-sqlite3';
import { openDatabase, resolveDatabasePath } from './db.js';
import { setPasswordChallengeActive } from './challenge-password.js';

const [id, active] = process.argv.slice(2);
if (!['weak-password', 'log-flood'].includes(id) || !['true', 'false'].includes(active)) {
  console.error('Usage: npm run challenge:set -- <weak-password|log-flood> <true|false>');
  process.exitCode = 1;
} else {
  const db = id === 'weak-password'
    ? new Database(resolveDatabasePath(), { fileMustExist: true })
    : openDatabase();
  db.pragma('foreign_keys = ON');
  try {
    if (id === 'weak-password') {
      setPasswordChallengeActive(db, active === 'true');
    } else {
      db.prepare('UPDATE challenges SET active = ? WHERE id = ?').run(Number(active === 'true'), id);
    }
    console.log(id + ': active=' + active + '. Database switches also apply in the internal production-mode exercise.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}
