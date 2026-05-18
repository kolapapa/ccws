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
git clone https://github.com/kolapapa/ccws ~/workspace/ccws
cd ~/workspace/ccws
./install.sh             # PATH + shell rc only
# Restart your shell (or `source ~/.zshrc`)
ccws init                # interactive setup wizard
```

Optional deps for nicer TUI: `brew install gum fzf`

## First-time setup · `ccws init`

`ccws init` is the entry point for new users. 3 steps:

1. **Detect `~/.claude/`** — if present, your existing setup stays as-is (plain `claude` keeps using it). If missing, optionally bootstrap an empty `~/.claude/` as the shared plugin store
2. **Install slash commands** `/whoami` and `/switch` into `~/.claude/commands/`
3. **Optionally add your first workspace** — for a different account or gateway (Anthropic / DeepSeek / Kimi / etc.). You choose the name (no auto `default`)

ccws doesn't auto-create a "default" workspace. Existing `~/.claude/` stays as your unmanaged primary; ccws only manages workspaces you explicitly name. Mental model:

| | Node | Claude Code |
|---|---|---|
| System default | `node` (system install) | `claude` (uses `~/.claude/`) |
| Managed alternates | `nvm use 18 && node` | `ccws use work && claude` |

Idempotent: re-running shows status instead of repeating setup. Use `ccws init --reset` to wipe and restart.

If you have no `~/.claude/` yet, `ccws init` offers to create an empty one (so plugins have somewhere to live) or asks you to run `claude` once first.

## Usage

```bash
# Interactive picker (the recommended entry)
$ ccws

# Interactive add (prompts for name / endpoint / token):
$ ccws add

# Or one-liner CLI:
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

## Directory-scoped workspaces (pyenv-style)

`ccws` resolves the active workspace from three sources, in priority order:

1. `CCWS_NAME` env var — set by `ccws use <name>` (shell scope)
2. `.ccws-workspace` file in `$PWD` or any parent (directory scope)
3. `~/.ccws/global` (user default)
4. Nothing — `claude` falls back to plain `~/.claude/`

```bash
# In a project directory, pin a workspace:
cd ~/work/projectA
ccws local company              # writes .ccws-workspace

# Set a user-wide default:
ccws global personal              # writes ~/.ccws/global

# Inspect resolution:
ccws which                        # prints: company
ccws which --explain              # also prints the source (local/global/shell)

# Activate the resolved workspace in the current shell:
ccws use $(ccws which)
```

For automatic activation (so `claude` in any directory auto-picks up the scope), see the `claude` wrapper section below.

## `claude` wrapper (opt-in auto-activation)

When enabled, the `claude` command auto-resolves the current scope and runs Claude Code with that workspace's env — without permanently mutating your shell. Like `pyenv` shims `python`.

Enable in `~/.zshrc` (or `~/.bashrc`):

```bash
eval "$(ccws hook --shell zsh)"     # ccws() function
eval "$(ccws hook --claude)"        # claude() wrapper
```

Now:

```bash
cd ~/work/projectA && claude      # uses .ccws-workspace's workspace
cd ~/personal && claude           # uses .ccws-workspace's workspace (different!)
cd /tmp && claude                 # uses ~/.ccws/global or plain ~/.claude/

# Override in current shell (highest priority):
ccws use company
claude                            # uses company regardless of $PWD
```

The wrapper does NOT modify your parent shell's env — `echo $ANTHROPIC_BASE_URL` after `claude` exits will show whatever was there before.

## Proxy per workspace

Some Claude endpoints (Anthropic direct from certain regions) need an HTTP/SOCKS proxy. Others (gateway endpoints like DeepSeek) don't. ccws supports per-workspace proxy settings:

```bash
# Interactive add prompts for proxy:
$ ccws add anth
Endpoint URL (Anthropic default, blank to skip): https://api.anthropic.com
API token (paste, hidden; blank to skip): sk-***
Enable proxy? [y/N]: y
Proxy URL [http://127.0.0.1:7890]:

# Or one-liner:
$ ccws add anth --base-url https://api.anthropic.com --token sk-x --proxy http://127.0.0.1:7890
```

Stored as `HTTPS_PROXY=` / `HTTP_PROXY=` in `ccws.env`. Switching workspaces auto-unsets them so a non-proxy workspace doesn't leak through.

For SOCKS or fine-grained control, append directly to `ccws.env`:

```bash
cat >> ~/.ccws/workspaces/anth/ccws.env <<'EOF'
ALL_PROXY=socks5://127.0.0.1:7890
NO_PROXY=localhost,127.0.0.1,.internal
EOF
```

ccws exports all of `HTTPS_PROXY` / `HTTP_PROXY` / `ALL_PROXY` / `NO_PROXY` (plus their lowercase forms) from `ccws.env`.

## Custom env vars per workspace

`ccws use` exports every `ANTHROPIC_*` and `CLAUDE_*` key it finds in the workspace's `ccws.env` file. To add custom vars (model routing, effort level, anything Claude Code reads), append them to the file:

```bash
ccws add deepseek --base-url https://api.deepseek.com/anthropic --token sk-xxx

cat >> ~/.ccws/workspaces/deepseek/ccws.env <<'EOF'
ANTHROPIC_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
CLAUDE_CODE_EFFORT_LEVEL=max
EOF

ccws use deepseek
echo $ANTHROPIC_MODEL    # deepseek-v4-pro[1m]
claude
```

Switching workspaces (`ccws use <other>`) automatically unsets the previous workspace's vars first — no stale `ANTHROPIC_MODEL` leaking across accounts. The `CCWS_EXPORTED` variable tracks what's currently active.

Internal metadata keys (`CCWS_NAME`, `CCWS_CREATED`, `CCWS_DESCRIPTION`) are NOT exported into the claude process — only `ANTHROPIC_*` / `CLAUDE_*` / `CCWS_BINARY` / `CCWS_NAME` (re-set) / `CCWS_REAL_HOME` / `CLAUDE_CONFIG_DIR`.

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
ccws                       Open interactive TUI picker (Catppuccin Mocha)
ccws init                  First-time setup wizard
ccws add [<name> [...]]    Create a workspace (interactive if no args)
                           [--base-url URL] [--token TOK] [--binary PATH]
                           [--proxy URL] [--description DESC]
ccws use <name>            Activate workspace in current shell
ccws unset                 Deactivate workspace in current shell
ccws local <name>          Set .ccws-workspace in $PWD (pyenv-style)
ccws local --unset         Remove .ccws-workspace
ccws global <name>         Set user-default workspace
ccws global --unset        Clear user-default
ccws which [--explain]     Resolve active workspace (shell > local > global)
ccws hook --shell zsh      Emit init code (eval in ~/.zshrc)
ccws hook --claude         Emit claude() wrapper (opt-in auto-activation)
ccws list [--verbose]      List all workspaces
ccws current [--path]      Show currently active workspace
ccws rm <name> [-f]        Remove workspace
ccws doctor                Run health checks
ccws sync [<name>]         Re-link symlinks for one or all workspaces
ccws --no-tui              Bypass TUI when called without args
ccws --help                Show this help
```

## License

MIT
