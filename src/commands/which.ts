import { existsSync } from 'node:fs';
import { findLocalFile, resolveScope } from '../scope.js';
import { globalScopeFile } from '../paths.js';
import { logError } from '../logger.js';

export async function runWhich(argv: string[]): Promise<number> {
  const explain = argv[0] === '--explain' || argv[0] === '-v';
  if (argv[0] && argv[0].startsWith('-') && !explain) {
    logError(`unknown flag: ${argv[0]}`);
    return 2;
  }
  const resolved = resolveScope();
  if (resolved) {
    process.stdout.write(`${resolved.name}\n`);
    if (explain) process.stderr.write(`  source: ${resolved.source}\n`);
    return 0;
  }
  if (explain) {
    const local = findLocalFile();
    if (local) process.stderr.write(`  .ccws-workspace: ${local} (empty)\n`);
    else process.stderr.write(`  .ccws-workspace: not found in ${process.cwd()} or parents\n`);
    const gf = globalScopeFile();
    if (existsSync(gf)) process.stderr.write(`  global:          ${gf} (empty)\n`);
    else process.stderr.write(`  global:          not set (${gf})\n`);
    process.stderr.write('  CCWS_NAME:       unset\n');
  }
  return 1;
}
