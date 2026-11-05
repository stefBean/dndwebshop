// This application is an internal university exercise. Explicit database flags
// control both challenges, including in the production-mode Docker deployment.
export function createChallengeState(db) {
  return {
    isActive(id) {
      return db.prepare('SELECT active FROM challenges WHERE id = ?').get(id)?.active === 1;
    },
  };
}
