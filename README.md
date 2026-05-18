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
| [claude-account-switcher](https://github.com/ukogan/claude-account-switcher) (2★) | CLI account isolation | No multi-endpoint, no fish |
| ccws (this) | CLI + TUI + multi-endpoint + doctor + fish | Designed for terminal-heavy concurrent use |

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
```

## What it looks like

### Interactive picker (`ccws` with no args)

Runs gum + fzf for a polished picker with a live preview pane:

```
  ╔══════════════════════════════════════════════════════════════╗
  ║  ccws · Claude Code WorkSpace                                ║
  ╚══════════════════════════════════════════════════════════════╝

  › │ work       │ anthropic                        │ Workspace: work
    │ personal   │ anthropic                        │ Path:      ~/.ccws/workspaces/work
    │ deepseek   │ api.deepseek.com/anthropic       │
    │ company  │ anthropic                        │ --- ccws.env ---
                                                    │ CCWS_NAME=work
                                                    │ CCWS_CREATED=2026-05-17T12:30:00Z
                                                    │ ANTHROPIC_BASE_URL=https://...
                                                    │ ANTHROPIC_AUTH_TOKEN=***
                                                    │ Sessions: 47

  ↑/↓ navigate · Enter activate · ESC cancel
```

After selecting, ccws asks `Launch claude now? [Y/n]` — press Enter and you're inside Claude with the chosen workspace active.

If `fzf` / `gum` aren't installed, ccws falls back to a pure-bash numbered menu (no extra deps required):

```
  ccws · Claude Code WorkSpace

    * 1) work                 (anthropic)
      2) personal             (anthropic)
      3) deepseek             (api.deepseek.com/anthropic)
      4) company            (anthropic)

  Enter number (1-4) or q to quit: _
```

### Multi-shell concurrent — the killer feature

```
┌───── Terminal 1 ────────────────┐  ┌───── Terminal 2 ────────────────┐
│ $ ccws use work                  │  │ $ ccws use personal              │
│ $ ccws current                   │  │ $ ccws current                   │
│ work (CLAUDE_CONFIG_DIR=         │  │ personal (CLAUDE_CONFIG_DIR=     │
│   ~/.ccws/workspaces/work)       │  │   ~/.ccws/workspaces/personal)   │
│ $ claude                         │  │ $ claude                         │
│ > Hi! Working on $WORK_PROJECT…  │  │ > Hi! Working on my side-project │
└──────────────────────────────────┘  └──────────────────────────────────┘
            ↓                                       ↓
   work account auth tokens              personal account auth tokens
   work sessions / history               personal sessions / history
              ↓                                     ↓
     shared plugins/skills              shared plugins/skills
        from ~/.claude/                   from ~/.claude/
```

Each terminal exports its own `CLAUDE_CONFIG_DIR` and endpoint env vars. Plugin code is shared via symlinks — install once, work everywhere.

### `ccws list --verbose`

```
$ ccws list --verbose
* work        endpoint=anthropic                          created=2026-05-17T12:30:00Z
  personal    endpoint=anthropic                          created=2026-05-17T12:45:15Z
  deepseek    endpoint=https://api.deepseek.com/anthropic created=2026-05-17T13:02:33Z
  company   endpoint=anthropic                          created=2026-05-17T13:18:07Z
```

`*` marks the workspace currently active in **this** shell.

### `ccws doctor`

```
$ ccws doctor
ccws doctor — environment health checks

  ✓ ~/.claude/ exists
  ✓ ~/.ccws/ initialized
  ✓ workspace 'work' symlinks ok
  ✓ workspace 'personal' symlinks ok
  ✓ workspace 'deepseek' symlinks ok
  ✓ workspace 'company' symlinks ok
  ✓ workspace 'work' env valid
  ✓ workspace 'personal' env valid
  ✓ workspace 'deepseek' env valid
  ✓ workspace 'company' env valid
  ✓ claude binary on PATH
  ✓ shell rc has ccws init

summary: 0 warning(s), 0 error(s)
```

Color-coded: `✓` green ok · `!` yellow warning · `✗` red error.

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
ccws doctor             Run health checks
ccws sync [<name>]      Re-link symlinks for one or all workspaces
ccws --no-tui           Bypass TUI when called without args
ccws --help             Show this help
```

## License

MIT
