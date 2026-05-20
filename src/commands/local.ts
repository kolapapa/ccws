import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { wsDir } from '../paths.js';
import { validateName } from '../validate.js';
import { logError, logOk, logWarn } from '../logger.js';

const MARKER = '.ccws-workspace';

export async function runLocal(argv: string[]): Promise<number> {
  const target = join(process.cwd(), MARKER);

  if (argv.length === 0) {
    if (!existsSync(target)) {
      logError(`no ${MARKER} in ${process.cwd()}`);
      return 1;
    }
    const text = readFileSync(target, 'utf8');
    const line = text.split('\n').find((l) => l.replace(/\s+/g, '') !== '');
    if (!line) { logError(`${target} is empty`); return 1; }
    process.stdout.write(`${line.replace(/\s+/g, '')}\n`);
    return 0;
  }

  const first = argv[0]!;
  if (first === '--unset' || first === '-u') {
    if (existsSync(target)) { unlinkSync(target); logOk(`removed ${MARKER} from ${process.cwd()}`); return 0; }
    logWarn(`no ${MARKER} in ${process.cwd()}`);
    return 0;
  }
  if (first.startsWith('-')) { logError(`unknown flag: ${first}`); return 2; }

  const v = validateName(first);
  if (!v.ok) { logError(v.reason); return 2; }
  if (!existsSync(wsDir(first))) {
    logError(`workspace '${first}' does not exist (use 'ccws add ${first}' first)`);
    return 1;
  }
  writeFileSync(target, `${first}\n`);
  logOk(`set local workspace to '${first}' in ${process.cwd()}`);
  return 0;
}
