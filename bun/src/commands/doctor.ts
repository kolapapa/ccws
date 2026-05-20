import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ccwsRoot, envFile, realClaudeDir, workspacesDir } from '../paths.js';
import { parseEnvFile } from '../env.js';
import { farmVerify } from '../symlinkFarm.js';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

type Status = 'ok' | 'warn' | 'error';

function writeCheck(label: string, status: Status, detail: string): { warn: number; err: number } {
  let line = '';
  if (status === 'ok')    line = `  ${GREEN}✓${RESET} ${label}\n`;
  if (status === 'warn')  line = `  ${YELLOW}!${RESET} ${label} — ${detail}\n`;
  if (status === 'error') line = `  ${RED}✗${RESET} ${label} — ${detail}\n`;
  process.stdout.write(line);
  return { warn: status === 'warn' ? 1 : 0, err: status === 'error' ? 1 : 0 };
}

function claudeOnPath(): boolean {
  const pathEnv = process.env.PATH ?? '';
  for (const p of pathEnv.split(':')) {
    if (p === '') continue;
    const candidate = join(p, 'claude');
    try {
      const st = statSync(candidate);
      if (st.isFile() || st.isSymbolicLink()) return true;
    } catch { /* not found, keep looking */ }
  }
  return false;
}

export async function runDoctor(_argv: string[]): Promise<number> {
  let warns = 0; let errs = 0;
  const tally = (r: { warn: number; err: number }) => { warns += r.warn; errs += r.err; };

  process.stdout.write('ccws doctor — environment health checks\n\n');

  if (existsSync(realClaudeDir())) {
    tally(writeCheck('~/.claude/ exists', 'ok', ''));
  } else {
    tally(writeCheck("~/.claude/ missing — run 'claude' once to initialize, then 'ccws sync'", 'warn', '~/.claude/ not found'));
  }

  if (existsSync(ccwsRoot())) {
    tally(writeCheck('~/.ccws/ initialized', 'ok', ''));
  } else {
    tally(writeCheck('~/.ccws/ missing', 'warn', "run 'ccws add <name>' to create first workspace"));
  }

  const wsDir = workspacesDir();
  if (existsSync(wsDir)) {
    for (const n of readdirSync(wsDir)) {
      try { if (!statSync(join(wsDir, n)).isDirectory()) continue; } catch { continue; }
      const r = farmVerify(n);
      if (r.ok) tally(writeCheck(`workspace '${n}' symlinks ok`, 'ok', ''));
      else      tally(writeCheck(`workspace '${n}' has broken symlinks`, 'warn', `run 'ccws sync ${n}'`));
    }
    for (const n of readdirSync(wsDir)) {
      try { if (!statSync(join(wsDir, n)).isDirectory()) continue; } catch { continue; }
      const f = envFile(n);
      if (!existsSync(f)) {
        tally(writeCheck(`workspace '${n}' missing ccws.env`, 'error', "re-run 'ccws add' or hand-create"));
        continue;
      }
      const env = parseEnvFile(f);
      if (env.CCWS_NAME === n) tally(writeCheck(`workspace '${n}' env valid`, 'ok', ''));
      else tally(writeCheck(`workspace '${n}' env has wrong CCWS_NAME`, 'warn', `found '${env.CCWS_NAME ?? ''}'`));
    }
  }

  if ((process.env.CLAUDE_CONFIG_DIR ?? '') !== '' && (process.env.CCWS_NAME ?? '') === '') {
    tally(writeCheck('CLAUDE_CONFIG_DIR set outside ccws', 'warn', `${process.env.CLAUDE_CONFIG_DIR} — may conflict`));
  }

  if (claudeOnPath()) tally(writeCheck('claude binary on PATH', 'ok', ''));
  else                tally(writeCheck('claude binary not on PATH', 'error', 'install Claude Code first'));

  let foundInit = false;
  for (const rc of [join(process.env.HOME ?? '', '.bashrc'), join(process.env.HOME ?? '', '.zshrc'), join(process.env.HOME ?? '', '.config/fish/config.fish')]) {
    if (!existsSync(rc)) continue;
    try {
      if (readFileSync(rc, 'utf8').includes('ccws')) { foundInit = true; break; }
    } catch { /* unreadable rc */ }
  }
  if (foundInit) tally(writeCheck('shell rc has ccws init', 'ok', ''));
  else           tally(writeCheck('shell rc missing ccws init', 'warn', 'run install.sh to wire it up'));

  process.stdout.write(`\nsummary: ${warns} warning(s), ${errs} error(s)\n`);
  return errs === 0 ? 0 : 1;
}
