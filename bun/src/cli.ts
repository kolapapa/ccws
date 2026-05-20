import { logError } from './logger.js';
import { VERSION } from './version.js';

export const PICKER_SENTINEL = -1;

const USAGE = `ccws — Claude Code WorkSpace · per-shell environment switcher

Usage:
  ccws                       Open interactive TUI picker
  ccws init                  First-time setup wizard
  ccws add [<name>]          Create a workspace (interactive if no args)
                             [--base-url URL] [--token TOK] [--binary PATH]
                             [--proxy URL] [--description DESC]
  ccws use <name>            Activate workspace in current shell
  ccws unset                 Deactivate workspace in current shell
  ccws local <name>          Set .ccws-workspace in $PWD
  ccws local --unset         Remove .ccws-workspace from $PWD
  ccws global <name>         Set user-default workspace
  ccws global --unset        Clear user-default
  ccws which [--explain]     Resolve the active workspace
  ccws hook --shell zsh      Emit init code (eval in ~/.zshrc)
  ccws hook --claude         Emit claude() wrapper (opt-in)
  ccws list [--verbose]      List all workspaces
  ccws current [--path]      Show currently active workspace
  ccws rm <name> [-f]        Remove workspace
  ccws doctor                Run health checks
  ccws sync [<name>]         Re-link symlinks
  ccws --no-tui              Bypass TUI when called without args
  ccws --help                Show this help

For 'use'/'unset' to affect your current shell, source share/init.sh
(or share/init.fish for fish) in your rc.

First time? Run: ccws init
`;

type Handler = (argv: string[]) => Promise<number>;

const handlers: Record<string, Handler> = {};

export function registerCommand(name: string, fn: Handler): void {
  handlers[name] = fn;
}

export async function dispatch(argv: string[]): Promise<number> {
  let noTui = false;
  let rest = argv;
  if (rest[0] === '--no-tui') { noTui = true; rest = rest.slice(1); }

  const cmd = rest[0];
  if (cmd === undefined) {
    if (noTui) {
      process.stdout.write(USAGE);
      return 0;
    }
    return PICKER_SENTINEL;
  }
  if (cmd === '--help' || cmd === '-h') {
    process.stdout.write(USAGE);
    return 0;
  }
  if (cmd === '--version' || cmd === '-V') {
    process.stdout.write(`ccws ${VERSION}\n`);
    return 0;
  }
  const h = handlers[cmd];
  if (!h) {
    process.stderr.write(USAGE);
    logError(`unknown command: ${cmd}`);
    return 2;
  }
  return h(rest.slice(1));
}
