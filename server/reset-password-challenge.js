import Database from 'better-sqlite3';
import { resolveDatabasePath } from './db.js';
import { resetPasswordChallenge } from './challenge-password.js';

// Open only the existing initialized database: do not seed accounts or purge
// unrelated expired sessions as a side effect of this targeted reset.
const db = new Database(resolveDatabasePath(), { fileMustExist: true });
db.pragma('foreign_keys = ON');
try {
  resetPasswordChallenge(db);
  console.log('Password challenge reset: active=true, solved=false, target sessions invalidated.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  db.close();
}
