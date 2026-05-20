import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { logError } from '../logger.js';
import { shQuote } from '../shellQuote.js';

function shareDir(): string {
  if (process.env.CCWS_DIR && process.env.CCWS_DIR !== '') {
    return join(process.env.CCWS_DIR, 'share');
  }
  let d = dirname(process.execPath);
  for (let i = 0; i < 5; i++) {
    const candidate = join(d, 'share');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return resolve('share');
}

const USAGE = `Usage: ccws hook [--shell zsh|bash|fish] [--claude]

Emit shell code to eval from your rc file.

  --shell SHELL   Initialize the ccws shell function (use/unset/TUI).
                  Add to ~/.zshrc / ~/.bashrc:
                      eval "$(ccws hook --shell zsh)"
                  For fish, add to ~/.config/fish/config.fish:
                      ccws hook --shell fish | source

  --claude        Enable opt-in claude() wrapper.
                  Add to ~/.zshrc / ~/.bashrc:
                      eval "$(ccws hook --claude)"

These can be combined:
    eval "$(ccws hook --shell zsh --claude)"
`;

export async function runHook(argv: string[]): Promise<number> {
  let shell = '';
  let wantClaude = false;
  let showHelp = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--shell') { shell = argv[i + 1] ?? ''; i++; continue; }
    if (a === '--claude') { wantClaude = true; continue; }
    if (a === '-h' || a === '--help') { showHelp = true; continue; }
    logError(`unknown flag: ${a}`);
    return 2;
  }
  if (showHelp) { process.stderr.write(USAGE); return 0; }
  if (shell === '' && !wantClaude) { process.stderr.write(USAGE); return 2; }

  const share = shareDir();
  if (shell !== '') {
    if (shell === 'zsh' || shell === 'bash') {
      const p = join(share, 'init.sh');
      if (!existsSync(p)) { logError(`init.sh not found at ${p}`); return 1; }
      process.stdout.write(`source ${shQuote(p)}\n`);
    } else if (shell === 'fish') {
      const p = join(share, 'init.fish');
      if (!existsSync(p)) { logError(`init.fish not found at ${p}`); return 1; }
      process.stdout.write(`source ${p}\n`);
    } else {
      logError(`unsupported shell: ${shell} (zsh|bash|fish)`);
      return 2;
    }
  }
  if (wantClaude) {
    const p = join(share, 'claude-wrapper.sh');
    if (!existsSync(p)) { logError(`claude-wrapper.sh not found at ${p}`); return 1; }
    process.stdout.write(`source ${shQuote(p)}\n`);
  }
  return 0;
}
