import { createHash } from 'node:crypto';

// Flags belong to challenges, not users. Production always uses safe behavior.
export function createChallengeState(db, { production = false } = {}) {
  const md5 = (password) => createHash('md5').update(password).digest('hex');
  return {
    isActive(id) {
      return !production && db.prepare('SELECT active FROM challenges WHERE id = ?').get(id)?.active === 1;
    },
    verifyDemoPassword(password, stored) {
      return typeof stored === 'string' && md5(password) === stored;
    },
  };
}
