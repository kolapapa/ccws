import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ccwsRoot, realClaudeDir, workspacesDir } from '../paths.js';
import { logError, logInfo, logOk, logWarn } from '../logger.js';
import { promptLine, promptHidden, promptYn } from '../prompt.js';
import { runAdd } from './add.js';

const BANNER = `
╔══════════════════════════════════════════════╗
║  ccws · first-time setup                     ║
╚══════════════════════════════════════════════╝

`;

const HELP = `ccws init — interactive first-time setup

Usage: ccws init [--reset]

  --reset   Remove ~/.ccws/ and start fresh (asks confirmation)
`;

function findShareCommandsDir(): string | null {
  if (process.env.CCWS_DIR && process.env.CCWS_DIR !== '') {
    const p = join(process.env.CCWS_DIR, 'share/commands');
    if (existsSync(p)) return p;
  }
  let d = dirname(process.execPath);
  for (let i = 0; i < 5; i++) {
    const candidate = join(d, 'share/commands');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return null;
}

export async function runInit(argv: string[]): Promise<number> {
  let reset = false;
  for (const a of argv) {
    if (a === '--reset') { reset = true; continue; }
    if (a === '--help' || a === '-h') { process.stderr.write(HELP); return 0; }
    logError(`unknown flag: ${a}`);
    return 2;
  }

  const root = ccwsRoot();

  if (reset && existsSync(root)) {
    process.stderr.write(`!! reset will delete ${root} and all workspaces. continue? [y/N] `);
    const r = await promptLine('');
    if (r !== 'y' && r !== 'Y') { logInfo('cancelled'); return 1; }
    rmSync(root, { recursive: true, force: true });
    logOk(`removed ${root}`);
  }

  if (existsSync(workspacesDir())) {
    let entries: string[] = [];
    try { entries = readdirSync(workspacesDir()); } catch { entries = []; }
    if (entries.length > 0) {
      process.stderr.write('ccws init — already initialized.\n\nCurrent state:\n');
      const wsCount = entries.filter((n) => {
        try { return statSync(join(workspacesDir(), n)).isDirectory(); } catch { return false; }
      }).length;
      process.stderr.write(`  - ${wsCount} workspace(s)\n\nYou might want one of:\n`);
      process.stderr.write('  ccws add <name>     Add a new workspace\n');
      process.stderr.write('  ccws doctor         Health check\n');
      process.stderr.write('  ccws init --reset   Remove everything and start fresh\n');
      return 0;
    }
  }

  process.stderr.write(BANNER);

  mkdirSync(workspacesDir(), { recursive: true });

  process.stderr.write('[1/3] Checking ~/.claude/...\n\n');
  const claude = realClaudeDir();
  if (existsSync(claude)) {
    let plugins = 0; let skills = 0;
    try { if (existsSync(join(claude, 'plugins'))) plugins = readdirSync(join(claude, 'plugins')).length; } catch {}
    try { if (existsSync(join(claude, 'skills'))) skills = readdirSync(join(claude, 'skills')).length; } catch {}
    process.stderr.write(`  ✓ Found existing Claude Code install at ${claude}\n`);
    process.stderr.write(`    plugins: ${plugins} · skills: ${skills}\n\n`);
    process.stderr.write(`    Your existing setup stays as-is. Plain 'claude' keeps using it\n`);
    process.stderr.write(`    with your current account.\n`);
    process.stderr.write(`    ccws is for ADDITIONAL workspaces (other accounts / gateways).\n`);
    process.stderr.write(`    All workspaces share plugins/skills from ~/.claude/.\n`);
  } else {
    process.stderr.write('  ! No ~/.claude/ found.\n\n');
    process.stderr.write('  ccws needs ~/.claude/ as the shared plugin store. Two options:\n');
    process.stderr.write("    [a] Cancel — run 'claude' once first to bootstrap, then re-run 'ccws init'\n");
    process.stderr.write('    [b] Bootstrap empty ~/.claude/ now\n\n');
    const yes = await promptYn('  Bootstrap empty ~/.claude/?', 'N');
    if (!yes) { logInfo("cancelled. Run 'claude' once, then re-run 'ccws init'."); return 0; }
    for (const sub of ['commands', 'plugins', 'skills', 'hooks']) {
      mkdirSync(join(claude, sub), { recursive: true });
    }
    writeFileSync(join(claude, 'settings.json'), '{}');
    logOk(`created empty ${claude}/`);
  }

  process.stderr.write('\n[2/3] Installing slash commands...\n');
  const cmds = findShareCommandsDir();
  if (cmds && existsSync(cmds)) {
    mkdirSync(join(claude, 'commands'), { recursive: true });
    for (const f of readdirSync(cmds)) {
      if (!f.endsWith('.md')) continue;
      const dst = join(claude, 'commands', f);
      if (!existsSync(dst)) copyFileSync(join(cmds, f), dst);
    }
    logOk(`installed slash commands to ${claude}/commands/`);
  } else {
    logWarn('could not install slash commands (share/commands not found)');
  }

  process.stderr.write('\n[3/3] Add your first workspace?\n');
  process.stderr.write('      (for a different account or endpoint — leave blank to skip)\n\n');
  const firstName = await promptLine('  Workspace name (blank to skip): ');
  if (firstName !== '') {
    const firstUrl = await promptLine('  Endpoint URL (Anthropic default, blank to use it): ');
    const firstToken = await promptHidden('  API token (paste, hidden; blank to skip — login later): ');
    const args = [firstName, '--non-interactive'];
    if (firstUrl !== '') args.push('--base-url', firstUrl);
    if (firstToken !== '') args.push('--token', firstToken);
    const code = await runAdd(args);
    if (code === 0) logOk(`created workspace '${firstName}'`);
    else logError(`failed to create '${firstName}'`);
  } else {
    process.stderr.write('  (skipped)\n');
  }

  process.stderr.write('\nSetup complete.\n\nNext steps:\n');
  process.stderr.write('  ccws                  Open TUI picker\n');
  process.stderr.write('  ccws use <name>       Activate in this shell\n');
  process.stderr.write('  ccws add <name>       Add another workspace\n');
  process.stderr.write('  ccws doctor           Health check\n');
  process.stderr.write('  ccws --help           All commands\n\n');
  return 0;
}
