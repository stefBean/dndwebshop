import express from 'express';
import bcrypt from 'bcryptjs';
import argon2 from 'argon2';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const passwordFixture = Object.freeze(JSON.parse(
  readFileSync(new URL('./data/weak-password-fixture.json', import.meta.url), 'utf8'),
));
export const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
});
const challengeId = 'weak-password';

export function passwordChallengeState(db) {
  return db.prepare('SELECT active, target_user_id, solved_at, revision FROM challenges WHERE id = ?').get(challengeId);
}

// The persisted ID is authoritative. Never adopt an existing account by username.
export function passwordChallengeTarget(db) {
  const state = passwordChallengeState(db);
  if (!state.target_user_id) return null;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(state.target_user_id);
  if (!user || user.is_demo !== 1 || user.username !== passwordFixture.username) {
    throw new Error('Challenge target is missing or no longer matches its fictitious fixture.');
  }
  return user;
}

function ensureTarget(db) {
  const existing = passwordChallengeTarget(db);
  if (existing) return existing;
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(passwordFixture.username)) {
    throw new Error('Reserved challenge username already exists; no existing account was changed.');
  }
  const result = db.prepare(
    'INSERT INTO users (name, username, password_hash, challenge_password_hash, is_demo) VALUES (?, ?, ?, ?, 1)',
  ).run(passwordFixture.name, passwordFixture.username, passwordFixture.argon2Hash, passwordFixture.bcryptHash);
  db.prepare('UPDATE challenges SET target_user_id = ? WHERE id = ?').run(result.lastInsertRowid, challengeId);
  return passwordChallengeTarget(db);
}

export function setPasswordChallengeActive(db, active) {
  return db.transaction(() => {
    const target = active ? ensureTarget(db) : passwordChallengeTarget(db);
    const state = passwordChallengeState(db);
    if (state.active !== Number(active)) {
      if (target) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
      db.prepare('UPDATE challenges SET active = ?, solved_at = NULL, revision = revision + 1 WHERE id = ?')
        .run(Number(active), challengeId);
    }
    return passwordChallengeState(db);
  }).immediate();
}

// A reset restores the playable exercise (active), not the disabled installation default.
export function resetPasswordChallenge(db) {
  return db.transaction(() => {
    const target = ensureTarget(db);
    db.prepare('UPDATE users SET password_hash = ?, challenge_password_hash = ? WHERE id = ?')
      .run(passwordFixture.argon2Hash, passwordFixture.bcryptHash, target.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(target.id);
    db.prepare('UPDATE challenges SET active = 1, solved_at = NULL, revision = revision + 1 WHERE id = ?').run(challengeId);
    const restored = passwordChallengeTarget(db);
    if (restored.password_hash !== passwordFixture.argon2Hash ||
        restored.challenge_password_hash !== passwordFixture.bcryptHash ||
        db.prepare('SELECT 1 FROM sessions WHERE user_id = ?').get(target.id)) {
      throw new Error('Password challenge reset verification failed.');
    }
    return passwordChallengeState(db);
  }).immediate();
}

export function isPasswordChallengeTarget(db, user) {
  if (!user || user.is_demo !== 1 || passwordChallengeState(db).target_user_id !== user.id) return false;
  return user.id === passwordChallengeTarget(db)?.id;
}

export function passwordLoginSnapshot(db, user) {
  if (!isPasswordChallengeTarget(db, user)) return null;
  const state = passwordChallengeState(db);
  return {
    userId: user.id, active: state.active === 1, revision: state.revision,
    hash: state.active === 1 ? user.challenge_password_hash : user.password_hash,
  };
}

export async function verifyChallengePassword(password, snapshot) {
  try {
    if (snapshot.active) {
      if (!/^\$2[aby]\$04\$[./A-Za-z0-9]{53}$/.test(snapshot.hash || '')) return false;
      return await bcrypt.compare(password, snapshot.hash);
    }
    // Never dispatch bcrypt or scrypt hashes through the repaired target's verifier.
    if (!snapshot.hash?.startsWith('$argon2id$')) return false;
    return await argon2.verify(snapshot.hash, password);
  } catch {
    return false;
  }
}

// Call inside the same write transaction as session creation. An async verification
// from an older reset/mode must not recreate sessions or solve the new run.
export function passwordLoginIsCurrent(db, snapshot) {
  const target = passwordChallengeTarget(db);
  if (!target || target.id !== snapshot.userId) return false;
  const state = passwordChallengeState(db);
  const hash = state.active === 1 ? target.challenge_password_hash : target.password_hash;
  return state.revision === snapshot.revision && (state.active === 1) === snapshot.active && hash === snapshot.hash;
}

export function markPasswordChallengeSolved(db) {
  db.prepare("UPDATE challenges SET solved_at = COALESCE(solved_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) WHERE id = ?")
    .run(challengeId);
}

export function createPasswordChallengeRouter(db, challenges) {
  const router = express.Router();
  const publicDirectory = path.join(import.meta.dirname, 'public');
  router.get('/robots.txt', (req, res) => {
    res.set('Cache-Control', 'no-store').type('text/plain').sendFile(path.join(publicDirectory, 'robots.txt'));
  });
  router.use('/challenge-assets/weak-password', express.static(path.join(publicDirectory, 'weak-password'), {
    index: false, dotfiles: 'deny',
    setHeaders: (res) => res.set('Cache-Control', 'no-store'),
  }));
  router.get('/challenge-assets/weak-password/check-bcrypt.mjs', (req, res) => {
    res.set('Cache-Control', 'no-store').download(path.join(import.meta.dirname, 'tools/check-bcrypt.mjs'), 'check-bcrypt.mjs');
  });
  router.use('/challenge-assets/weak-password', (req, res) => res.status(404).json({ error: 'This exercise asset does not exist.' }));
  router.get('/api/backup/users', (req, res) => {
    if (!challenges.isActive(challengeId)) return res.status(404).json({ error: 'This API endpoint does not exist.' });
    if (Object.keys(req.query).length) return res.status(400).json({ error: 'This fixed test export accepts no parameters.' });
    const user = passwordChallengeTarget(db);
    if (!user || !/^\$2[aby]\$04\$[./A-Za-z0-9]{53}$/.test(user.challenge_password_hash || '')) {
      return res.status(503).json({ error: 'The exercise fixture is unavailable. Ask the operator to reset it.' });
    }
    // Intentional access weakness: no authentication/authorization, exclusively
    // this ID-bound fictitious record. CWE-916 is the cost of its bcrypt hash.
    return res.json({ users: [{ username: user.username, password_hash: user.challenge_password_hash }] });
  });
  router.get('/api/challenges/weak-password/status', (req, res) => {
    const state = passwordChallengeState(db);
    res.json({
      active: challenges.isActive(challengeId),
      ready: !!state.target_user_id,
      achieved: !!state.solved_at,
      solvedAt: state.solved_at,
      mode: challenges.isActive(challengeId) ? 'vulnerable-bcrypt' : 'safe-argon2id',
    });
  });
  return router;
}
