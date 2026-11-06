import { createAuditLog } from './audit-log.js';

const log = createAuditLog();
const status = await log.reset();
console.log(`Audit log reset (${status.logPath}): ${status.sizeBytes} bytes.`);
