# ccws · Claude Code WorkSpace

> Per-shell Claude Code workspace switcher — run different accounts in different terminals, simultaneously, with shared plugin code and isolated auth.

## What this solves

If you have multiple Claude Code accounts (work, personal, third-party gateway like DeepSeek), you want to:
- Run them in different terminal windows **at the same time**, no auth conflicts
- Share plugin code (gstack, superpowers, etc.) — no need to install three times
- Switch with one command, or pick interactively from a TUI

`ccws` is `nvm` for Claude Code: a shell function that sets `CLAUDE_CONFIG_DIR` and endpoint env vars per shell.

## Relationship to other tools

| Tool | What it does | Different from ccws |
|---|---|---|
| [cc-switch](https://github.com/farion1231/cc-switch) (73k★) | GUI account manager | Switches one account at a time, globally |
| [claude-account-switcher](https://github.com/ukogan/claude-account-switcher) (2★) | CLI account isolation | No multi-endpoint, no migrate, no fish |
| ccws (this) | CLI + TUI + multi-endpoint + migrate + doctor + fish | Designed for terminal-heavy concurrent use |

ccws complements cc-switch — different problem, different solution.

## Install

```bash
git clone https://github.com/<user>/ccws ~/workspace/ccws
cd ~/workspace/ccws
./install.sh
# Restart your shell
```

Optional deps for nicer TUI: `brew install gum fzf`

## Usage

```bash
# Interactive picker (the recommended entry)
$ ccws

# Or CLI:
$ ccws add work --base-url https://api.anthropic.com --token sk-...
$ ccws add personal
$ ccws add deepseek --base-url https://api.deepseek.com/anthropic --token sk-...

$ ccws list
$ ccws use work
$ ccws current
$ ccws doctor

# In another terminal, simultaneously:
$ ccws use personal && claude  # different account, same time, no conflict

# Migrate from existing setup:
$ ccws migrate                  # reads ~/.claude-profiles.conf
$ ccws migrate --from ~/myconf  # custom file
```

## Architecture

- Each workspace is a directory at `~/.ccws/workspaces/<name>/` and serves as `CLAUDE_CONFIG_DIR`
- A symlink farm shares plugins, skills, settings, MCP, hooks, etc. from `~/.claude/` into each workspace
- `ccws use <name>` is a shell function that exports `CLAUDE_CONFIG_DIR` + endpoint vars in the current shell
- Multiple shells can each have their own active workspace — no shared state mutation

## Commands

```
ccws                    Open interactive TUI picker (gum + fzf)
ccws add <name> [opts]  Create a workspace
                        [--base-url URL] [--token TOK] [--binary PATH]
ccws use <name>         Activate workspace in current shell
ccws unset              Deactivate workspace in current shell
ccws list [--verbose]   List all workspaces
ccws current [--path]   Show currently active workspace
ccws rm <name> [-f]     Remove workspace
ccws migrate [--from FILE]
                        Import workspaces from ~/.claude-profiles.conf
ccws doctor             Run health checks
ccws sync [<name>]      Re-link symlinks for one or all workspaces
ccws --no-tui           Bypass TUI when called without args
ccws --help             Show this help
```

## License

MIT
