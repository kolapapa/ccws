import { existsSync, rmSync } from 'node:fs';
import { wsDir } from '../paths.js';
import { validateName } from '../validate.js';
import { withLock } from '../lock.js';
import { logError, logInfo, logOk } from '../logger.js';
import { promptLine } from '../prompt.js';

export async function runRm(argv: string[]): Promise<number> {
  let name = '';
  let force = false;
  for (const a of argv) {
    if (a === '-f' || a === '--force') { force = true; continue; }
    if (a.startsWith('-')) { logError(`unknown flag: ${a}`); return 2; }
    if (name === '') name = a;
  }
  const v = validateName(name);
  if (!v.ok) { logError(v.reason); return 2; }

  const ws = wsDir(name);
  if (!existsSync(ws)) { logError(`workspace not found: ${name}`); return 1; }
  if ((process.env.CCWS_NAME ?? '') === name) {
    logError(`'${name}' is currently active in this shell; run 'ccws unset' first`);
    return 1;
  }
  if (!force) {
    const reply = await promptLine(`remove workspace "${name}" at ${ws}? [y/N] `);
    if (reply !== 'y' && reply !== 'Y') { logInfo('cancelled'); return 1; }
  }
  await withLock(10, async () => { rmSync(ws, { recursive: true, force: true }); });
  logOk(`removed workspace '${name}'`);
  return 0;
}
