import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { globalScopeFile, wsDir } from '../paths.js';
import { validateName } from '../validate.js';
import { logError, logOk, logWarn } from '../logger.js';

export async function runGlobal(argv: string[]): Promise<number> {
  const target = globalScopeFile();

  if (argv.length === 0) {
    if (!existsSync(target)) { logError('no global workspace set'); return 1; }
    const text = readFileSync(target, 'utf8');
    const line = text.split('\n').find((l) => l.replace(/\s+/g, '') !== '');
    if (!line) { logError(`${target} is empty`); return 1; }
    process.stdout.write(`${line.replace(/\s+/g, '')}\n`);
    return 0;
  }

  const first = argv[0]!;
  if (first === '--unset' || first === '-u') {
    if (existsSync(target)) { unlinkSync(target); logOk('removed global workspace'); return 0; }
    logWarn('no global workspace set');
    return 0;
  }
  if (first.startsWith('-')) { logError(`unknown flag: ${first}`); return 2; }

  const v = validateName(first);
  if (!v.ok) { logError(v.reason); return 2; }
  if (!existsSync(wsDir(first))) {
    logError(`workspace '${first}' does not exist (use 'ccws add ${first}' first)`);
    return 1;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${first}\n`);
  logOk(`set global workspace to '${first}'`);
  return 0;
}
