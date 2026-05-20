import { logError } from '../logger.js';
import { CLAUDE_WRAPPER, INIT_FISH, INIT_SH } from '../embedded.js';

const USAGE = `Usage: ccws hook [--shell zsh|bash|fish] [--claude]

Emit shell code to eval from your rc file. The script is embedded in the
binary; no share/ files on disk are needed.

  --shell SHELL   Initialize the ccws shell function (use/unset/picker).
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

  if (shell !== '') {
    if (shell === 'zsh' || shell === 'bash') {
      process.stdout.write(INIT_SH);
    } else if (shell === 'fish') {
      process.stdout.write(INIT_FISH);
    } else {
      logError(`unsupported shell: ${shell} (zsh|bash|fish)`);
      return 2;
    }
  }
  if (wantClaude) {
    process.stdout.write(CLAUDE_WRAPPER);
  }
  return 0;
}
