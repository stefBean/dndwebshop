import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// This tool reads local files only. It never calls a login endpoint.
export function extractHash(input) {
  const text = input.trim();
  if (text.startsWith('$2')) return text;
  const backup = JSON.parse(text);
  if (!Array.isArray(backup.users) || backup.users.length !== 1 ||
      typeof backup.users[0].password_hash !== 'string') {
    throw new Error('Expected one exported test account or a raw bcrypt hash.');
  }
  return backup.users[0].password_hash;
}

export async function crackBcrypt(hash, wordlist) {
  if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash)) throw new Error('Expected a bcrypt hash.');
  // Limit this educational tool to the intended cheap test fixture.
  if (bcrypt.getRounds(hash) !== 4) throw new Error('This exercise tool accepts cost 4 only.');
  const candidates = wordlist.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  for (const [index, candidate] of candidates.entries()) {
    if (await bcrypt.compare(candidate, hash)) return { password: candidate, attempts: index + 1 };
  }
  return null;
}

async function main() {
  const [hashFile, wordlistFile, ...extra] = process.argv.slice(2);
  if (!hashFile || !wordlistFile || extra.length) {
    throw new Error('Usage: node check-bcrypt.mjs <local-backup.json-or-hash.txt> <local-wordlist.txt>');
  }
  const hash = extractHash(await readFile(hashFile, 'utf8'));
  const wordlist = await readFile(wordlistFile, 'utf8');
  const started = performance.now();
  const result = await crackBcrypt(hash, wordlist);
  if (!result) {
    console.log('No matching candidate.');
    process.exitCode = 1;
    return;
  }
  console.log('Matching candidate: ' + result.password);
  console.log('Candidates checked: ' + result.attempts + '; elapsed: ' + Math.round(performance.now() - started) + ' ms.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
