import { createChallengeLog } from './challenge-log.js';

// Clears only the CWE-779 challenge log. Database, sessions and orders are
// intentionally untouched so the challenge can be repeated without a full reset.
const log = createChallengeLog();
const status = await log.reset();
console.log(`Challenge log reset (${status.logPath}): ${status.sizeBytes} bytes.`);
