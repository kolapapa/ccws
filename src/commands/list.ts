import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { envFile, workspacesDir } from '../paths.js';
import { parseEnvFile } from '../env.js';
import { logInfo } from '../logger.js';

export async function runList(argv: string[]): Promise<number> {
  const verbose = argv[0] === '--verbose' || argv[0] === '-v';
  const dir = workspacesDir();
  if (!existsSync(dir)) {
    logInfo("no workspaces yet — run 'ccws add <name>'");
    return 0;
  }
  const active = process.env.CCWS_NAME ?? '';
  const entries = readdirSync(dir).filter((n) => {
    try { return statSync(join(dir, n)).isDirectory(); } catch { return false; }
  });
  if (entries.length === 0) {
    logInfo('no workspaces yet');
    return 0;
  }
  for (const name of entries) {
    const isActive = name === active;
    const marker = isActive ? '* ' : ' ';
    if (verbose) {
      const env = parseEnvFile(envFile(name));
      const endpoint = env.ANTHROPIC_BASE_URL && env.ANTHROPIC_BASE_URL !== '' ? env.ANTHROPIC_BASE_URL : 'anthropic';
      const created = env.CCWS_CREATED && env.CCWS_CREATED !== '' ? env.CCWS_CREATED : '?';
      process.stdout.write(`${marker}${name}  endpoint=${endpoint}  created=${created}\n`);
    } else {
      process.stdout.write(`${marker}${name}\n`);
    }
  }
  return 0;
}
