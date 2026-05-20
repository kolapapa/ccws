import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { workspacesDir, wsDir } from '../paths.js';
import { validateName } from '../validate.js';
import { farmSync } from '../symlinkFarm.js';
import { logError, logInfo, logOk } from '../logger.js';

export async function runSync(argv: string[]): Promise<number> {
  const name = argv[0];

  if (name !== undefined) {
    const v = validateName(name);
    if (!v.ok) { logError(v.reason); return 2; }
    if (!existsSync(wsDir(name))) { logError(`workspace not found: ${name}`); return 1; }
    farmSync(name);
    logOk(`synced workspace '${name}'`);
    return 0;
  }

  const dir = workspacesDir();
  if (!existsSync(dir)) { logInfo('no workspaces'); return 0; }
  let count = 0;
  for (const n of readdirSync(dir)) {
    try { if (!statSync(join(dir, n)).isDirectory()) continue; } catch { continue; }
    farmSync(n);
    count += 1;
  }
  logOk(`synced ${count} workspace(s)`);
  return 0;
}
