import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { envFile, workspacesDir } from '../paths.js';
import { parseEnvFile } from '../env.js';
import { logInfo } from '../logger.js';

const useColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;
const RESET = useColor ? '\x1b[0m' : '';
const BOLD = useColor ? '\x1b[1m' : '';
const GREEN = useColor ? '\x1b[32m' : '';
const CYAN = useColor ? '\x1b[36m' : '';
const YELLOW = useColor ? '\x1b[33m' : '';
const MAGENTA = useColor ? '\x1b[35m' : '';
const GRAY = useColor ? '\x1b[90m' : '';

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
  if (!verbose) {
    for (const name of entries) {
      const isActive = name === active;
      const marker = isActive ? `${GREEN}* ${RESET}` : '  ';
      const nameStr = isActive ? `${GREEN}${BOLD}${name}${RESET}` : name;
      process.stdout.write(`${marker}${nameStr}\n`);
    }
    return 0;
  }

  const rows = entries.map((name) => {
    const env = parseEnvFile(envFile(name));
    return {
      name,
      isActive: name === active,
      isHome: env.CCWS_NO_ISOLATE === '1',
      endpoint: env.ANTHROPIC_BASE_URL && env.ANTHROPIC_BASE_URL !== '' ? env.ANTHROPIC_BASE_URL : 'anthropic',
      created: env.CCWS_CREATED && env.CCWS_CREATED !== '' ? env.CCWS_CREATED : '?',
    };
  });
  const nameW = Math.max(...rows.map((r) => r.name.length));
  const endpointW = Math.max(...rows.map((r) => r.endpoint.length));

  for (const r of rows) {
    const marker = r.isActive ? `${GREEN}*${RESET} ` : '  ';
    const namePadded = r.name.padEnd(nameW);
    const nameStr = r.isActive ? `${GREEN}${BOLD}${namePadded}${RESET}` : namePadded;
    const endpointPadded = r.endpoint.padEnd(endpointW);
    const home = r.isHome ? `  ${MAGENTA}· home${RESET}` : '';
    process.stdout.write(
      `${marker}${nameStr}  ${GRAY}endpoint=${RESET}${CYAN}${endpointPadded}${RESET}  ${GRAY}created=${RESET}${YELLOW}${r.created}${RESET}${home}\n`
    );
  }
  return 0;
}
