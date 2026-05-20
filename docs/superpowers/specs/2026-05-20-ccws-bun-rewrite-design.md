# ccws Bun + TypeScript rewrite

Date: 2026-05-20
Status: design accepted, pending Phase 1 implementation plan
Predecessor: bash-based ccws (current) + fzf-based TUI (DESIGN.md "Surface
registry")

## Goal

Rewrite ccws in TypeScript on the Bun runtime, distributed as a single
compiled binary per platform. The current bash implementation works for
non-TUI commands but the fzf-based picker has accumulated unfixable
friction (cursor-jump on reload, search/hotkey collisions, nested-parens
parsing bugs in fzf bind syntax, version-dependent default rendering).

The rewrite is incremental: the TUI picker ships first (Phase 1), then
other commands move to TS one Phase at a time. The bash implementation
stays as the fallback / co-installed runtime through Phase 4. Phase 5
removes the bash code entirely and the binary becomes canonical.

## Non-goals

- No port to Go / Rust / C — user explicitly asked for Bun + Node.js
  ecosystem.
- No GUI / web UI. CLI + TUI only.
- No mouse support in the TUI (terminal mouse handling is unreliable
  cross-platform).
- No `ccws` daemon or persistent background process. Each invocation is
  a one-shot process.
- No Windows support (ccws is a unix shell tool).
- No animations / spinners. The picker is render-on-state-change; no
  long-running operations to animate.
- No replacement of `share/init.sh` / `share/init.fish` — the shell-side
  wrappers stay (they're the eval entry point and shell-agnostic).

## Decisions (locked by brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Scope | Full rewrite. All `ccws` commands eventually become TS. |
| 2 | Delivery cadence | Phased: TUI picker first, then commands one by one. |
| 3 | TUI library | Ink (React-on-terminal). |
| 4 | Runtime | Bun, single-binary compile (`bun build --compile`). |
| 5 | Dev workflow | Git worktree (`../ccws-bun`) so current bash ccws keeps working. |
| 6 | Repo layout | New code lives in `bun/` subdir. Bash code at root unchanged until Phase 5. |
| 7 | Picker toggle key | `Tab` (not `y`). With Ink we control input fully, but typing characters into the filter must work — Tab avoids that collision. |
| 8 | Binary distribution | GitHub Releases, 4 binaries (darwin/linux × arm64/x64). |
| 9 | Phase 1 contract | Binary outputs selected name on stdout. dangerous flag stays in ccws.env (written by picker), bash exports it as usual. |

## Architecture (Phase 1 → Phase 5)

```
~/workspace/ccws/                ← main checkout (your daily ccws)
├── bin/ccws                     ← bash dispatcher (Phase 1-4 unchanged)
├── lib/                         ← bash libs (Phase 1-4 unchanged)
│   └── tui.sh                   ← invokes new binary if present, falls back to fzf
├── share/init.sh                ← shell wrapper (stays even at v1.0)
├── share/init.fish              ← shell wrapper (stays even at v1.0)
├── tests/integration/*.bats     ← bash tests (Phase 1-4)
├── bun/                         ← 🆕 Bun/TS code lives here
│   ├── src/
│   │   ├── picker/              ← Ink components (Phase 1)
│   │   │   ├── App.tsx
│   │   │   ├── Logo.tsx
│   │   │   ├── Search.tsx
│   │   │   ├── List.tsx
│   │   │   ├── Row.tsx
│   │   │   ├── Preview.tsx
│   │   │   └── state.ts
│   │   ├── env.ts               ← ccws.env parser (Phase 1 read-only; Phase 2-3 write)
│   │   ├── workspace.ts         ← ~/.ccws/workspaces/ scanner
│   │   ├── colors.ts            ← Catppuccin Mocha palette as truecolor escapes
│   │   ├── index.ts             ← Phase 1: entry point = picker
│   │   └── cli.ts               ← Phase 2+: full CLI dispatcher
│   ├── tests/
│   │   ├── picker/              ← ink-testing-library snapshot + interaction tests
│   │   └── *.test.ts            ← vitest unit tests
│   ├── package.json
│   ├── tsconfig.json
│   ├── build.ts                 ← `bun build --compile` driver
│   └── README.md
├── DESIGN.md                    ← amended with bun arch section
└── docs/superpowers/{specs,plans}/  ← this spec + later plans
```

At Phase 5: `bin/` and `lib/` deleted; `bun/dist/ccws` becomes the
`bin/ccws` (renamed). `share/` survives.

## Dev workflow — git worktree

User wants to develop in isolation. Standard gstack pattern:

```bash
cd ~/workspace/ccws
git worktree add ../ccws-bun -b spec/bun-rewrite
cd ../ccws-bun/bun
bun install
bun run dev
```

The main checkout (`~/workspace/ccws`) keeps the existing bash ccws.
`~/.zshrc`'s `source ~/workspace/ccws/share/init.sh` is unchanged. While
developing the new binary, you `ccws` (bash) as usual; you only see the
new binary when you explicitly run it from `../ccws-bun/bun/dist/ccws-picker`
or after Phase 1 ships and the bash `lib/tui.sh` is wired to invoke it.

## Phased delivery

| Phase | Ships | bash code removed | Notes |
|-------|-------|--------|-------|
| 1 (v0.7) | Compiled `ccws-picker` binary. bash `lib/tui.sh` calls it (fzf fallback retained). | None | Solves the immediate picker UX pain. |
| 2 (v0.8) | TS reimplementation of `ccws use` / `ccws unset` / `ccws list` / `ccws current`. | `lib/cmd_use.sh`, `cmd_unset.sh`, `cmd_list.sh`, `cmd_current.sh` | These are the most-used commands; pure read + format, lowest risk. |
| 3 (v0.9) | TS reimplementation of `ccws add` / `ccws rm` / `ccws sync`. | Corresponding cmd_*.sh | Mutating commands; need careful symlink-farm and lock-file translation. |
| 4 (v0.10) | TS reimplementation of `ccws init` / `ccws doctor` / `ccws which` / `ccws local` / `ccws global` / `ccws hook`. | Corresponding cmd_*.sh | Less-used; final cleanup. |
| 5 (v1.0) | bash entry + libs deleted. `bun/dist/ccws` is THE ccws. | All of `bin/ccws`, `lib/*.sh`, `tests/integration/*.bats` | Atomic switch. share/init.sh and share/init.fish stay. |

Each Phase is a separate PR. Between phases, both implementations
coexist. Either implementation can be the "active" one in `bin/ccws` —
Phase 1—4 keep bash dispatching, Phase 5 flips to binary.

## Phase 1 in detail

This spec focuses on Phase 1. Subsequent phases get their own specs when
they're up next.

### Binary contract

The Phase 1 binary is a one-shot picker:

```
Invocation:  $HOME/.ccws/bin/ccws-picker

Inputs:
  - Read: ~/.ccws/workspaces/*/ccws.env
  - Read: $CCWS_NAME (for "· active" marker)
  - Read: $CCWS_NO_LOGO, $COLUMNS, $LINES (logo gating)

Outputs:
  - stdout: <selected_name>\n  (on selection)
  - stdout: <empty>            (on Esc / cancel)
  - stderr: TUI rendering      (alt-screen, auto-cleared on exit)

Exit codes:
  - 0   selected ok
  - 130 cancelled (Esc, SIGINT)
  - 1   error (corrupt state, missing dirs, etc.)
```

`lib/tui.sh` after Phase 1:

```bash
ccws_tui_run() {
    local binary="$HOME/.ccws/bin/ccws-picker"
    if [[ -x "$binary" ]]; then
        "$binary"
        return $?
    fi
    # Fallback to fzf/fallback if the binary isn't installed yet
    local engine=$(ccws_tui_engine)
    case "$engine" in
        fzf)      source "$_libdir/tui_fzf.sh";      ccws_tui_fzf_pick      ;;
        fallback) source "$_libdir/tui_fallback.sh"; ccws_tui_fallback_pick ;;
    esac
}
```

The dangerous flag is persisted into the workspace's ccws.env by the
picker (when user pressed Tab). bash's existing `ccws_cmd_use_print_exports`
reads `CCWS_DANGEROUS=1` from ccws.env and exports it via the `CCWS_*`
pattern. `share/init.sh` sees the env var and runs `claude
--dangerously-skip-permissions`. The flag flow is unchanged from the
current bash implementation — only the picker rendering moves.

### Picker UX

Layout (full-screen alt-screen, exits clean):

```
┌────────────────────────────────────────────────────────────┐
│  [6-row gradient ASCII "ccws" logo]                        │
│  ────────────────────────────────                          │
│  ↑↓ navigate    type to filter    ↵ activate               │
│  Tab toggle yolo    esc cancel                             │
│                                                            │
│  › [filter input]                              N/M         │
│                                                            │
│  ❯ astratech    anthropic       ● proxy   · safe           │
│    deepseek     deepseek-gw     ○ direct  ⚡ yolo          │
│    gradient     aigwasia-...    ○ direct  · safe           │
│                                                            │
│  ────────────────────────────────                          │
│  endpoint:    https://api.anthropic.com                    │
│  token:       ***                                          │
│  model:       claude-opus-4-7[1m]                          │
│  created:     2026-05-18                                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

Header (logo + rule + help) is ABOVE the input row (mirrors current
`--header-first` behavior).

### Keybindings

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate list (skips when at top/bottom — no wrap) |
| any printable char | Append to filter, list re-filters by fuzzy name match |
| `Backspace` | Delete last filter char |
| `Tab` | Toggle current row's `CCWS_DANGEROUS` flag in its ccws.env, re-read, cursor stays on same row |
| `↵` Enter | Emit current row's name to stdout, exit 0 |
| `Esc` / `Ctrl-C` | Exit 130, empty stdout |
| `PgUp` / `PgDn` | Preview scroll (only when preview content overflows; future) |

`Tab` (not `y`) deliberately avoids the type-to-filter collision. With
Ink we control input fully, but Tab is conventionally a "secondary
action / cycle" key and never appears in workspace names.

### State model (Ink / React)

```typescript
interface PickerState {
  workspaces: Workspace[];   // freshly scanned each render after toggle
  query: string;             // filter input
  cursorName: string;        // identity-keyed (not index) so cursor sticks
}

interface Workspace {
  name: string;
  endpoint: string;          // ANTHROPIC_BASE_URL or 'anthropic'
  proxy: boolean;            // HTTPS_PROXY etc. present in ccws.env
  dangerous: boolean;        // CCWS_DANGEROUS=1 in ccws.env
  active: boolean;           // process.env.CCWS_NAME === name
  envPath: string;           // absolute path to ccws.env
  rawEnv: Record<string,string>;  // for preview
}
```

State transitions:
- `setQuery(q)` — filter re-runs; if cursorName isn't in filtered set, snap to first filtered row.
- `setCursor(name)` — on ↑↓ moves cursor by computing prev/next in filtered list.
- `toggleDangerous()` — write `CCWS_DANGEROUS=1` (or remove) to current row's ccws.env, re-read all workspaces, cursorName preserved.

### Components

```typescript
<App>
  <Logo />            // 6-row gradient, gated by env (mirrors current logic)
  <Header rule help />
  <Search query={query} onChange={...} />
  <Counter shown={filtered.length} total={workspaces.length} />
  <List>
    {filtered.map(ws => <Row key={ws.name} workspace={ws} cursor={ws.name === cursorName} />)}
  </List>
  <Preview workspace={cursorWorkspace} />
</App>
```

Each component is a functional React component using Ink's primitives:
`<Box>`, `<Text>`, `useInput`, `useApp`. No class components, no
external state library (useState/useReducer at App is enough).

### Logo gating

Same four gates as current bash implementation, expressed in TS:

```typescript
function shouldRenderLogo(): boolean {
  if (process.env.CCWS_NO_LOGO === '1') return false;
  if (!process.stderr.isTTY) return false;
  const cols = process.stdout.columns ?? 80;
  const lines = process.stdout.rows ?? 24;
  if (cols < 36) return false;
  if (lines < 24) return false;
  return true;
}
```

CCWS_TUI_LOGO_FORCE (current bash test hook) is replaced by a vitest /
ink-testing-library fixture — no need for an env-var hook in TS.

### ccws.env parsing (read-only in Phase 1)

`src/env.ts` exports:

```typescript
export function parseEnvFile(path: string): Record<string,string>;
export function setEnvKey(path: string, key: string, value: string): void;
export function unsetEnvKey(path: string, key: string): void;
```

Phase 1 needs `parseEnvFile` (preview + dangerous detection) and
`setEnvKey` / `unsetEnvKey` (the Tab toggle).

Spec for the parser:
- Lines like `KEY=value` (no quotes, no escapes — current bash format)
- Lines starting with `#` are comments → skipped
- Empty lines skipped
- Key must match `[A-Za-z_][A-Za-z0-9_]*`; lines with invalid keys are skipped
- Last occurrence of a duplicate key wins (matches bash grep `-m1`
  semantics with `head -1` doesn't, but the existing bash never writes
  duplicates — only legacy hand-edited files might)

Round-trip preservation: `setEnvKey` and `unsetEnvKey` must preserve
comments, blank lines, and ordering. Replace in-place if key exists,
otherwise append.

### Preview content

The preview pane renders the same key/label pairs the current bash
preview shows, in the same order, from a constant array (the bash
`CCWS_PREVIEW_KEYS` becomes `src/picker/previewKeys.ts`):

```typescript
export const PREVIEW_KEYS: Array<{ env: string; label: string }> = [
  { env: 'ANTHROPIC_BASE_URL', label: 'endpoint' },
  { env: 'HTTPS_PROXY',         label: 'proxy' },
  { env: 'https_proxy',         label: 'proxy' },
  // ... matching the bash list ...
];
```

Same label-dedup rule (`HTTPS_PROXY` and `https_proxy` both → `proxy`,
show once). Same masking for `*_TOKEN` / `*_AUTH` → `***`.

## Distribution

### Build

```typescript
// bun/build.ts
const targets = [
  { triple: 'bun-darwin-arm64', out: 'dist/ccws-picker-darwin-arm64' },
  { triple: 'bun-darwin-x64',   out: 'dist/ccws-picker-darwin-x64' },
  { triple: 'bun-linux-arm64',  out: 'dist/ccws-picker-linux-arm64' },
  { triple: 'bun-linux-x64',    out: 'dist/ccws-picker-linux-x64' },
];

for (const { triple, out } of targets) {
  await Bun.spawn({
    cmd: ['bun', 'build', '--compile',
          '--target', triple,
          '--minify',
          'src/index.ts',
          '--outfile', out],
  });
}
```

Expected binary size: ~80MB per platform (Bun runtime + Ink + React).

### Release

GitHub Actions workflow on tag push (e.g. `v0.7.0`):

1. Run vitest + bats tests
2. Run `bun build` for all 4 platforms
3. Generate SHA256 checksums
4. Create GitHub Release with 4 binaries + `SHA256SUMS`

### Install

Two paths:

1. **Manual**: user downloads from GitHub Releases, places in
   `~/.ccws/bin/ccws-picker`, `chmod +x`.

2. **Automated** (via existing `ccws init`): Phase 1 amends `ccws init`
   to detect platform, download the right binary from the latest
   release, place + chmod. Bash code in `lib/cmd_init.sh`.

The bash `lib/tui.sh` invokes `$HOME/.ccws/bin/ccws-picker` if it
exists, else falls back to fzf — so Phase 1 ships without breaking
existing users: they keep the fzf picker until they update.

## Testing

### TS side

- **vitest** — unit tests for `env.ts`, `workspace.ts`, picker state
  reducers.
- **ink-testing-library** — render picker components, simulate key
  events, snapshot assertions.

```
bun/tests/
├── env.test.ts                 ← parse / round-trip / setEnvKey
├── workspace.test.ts           ← scan ~/.ccws/workspaces fixture
├── picker/
│   ├── App.test.tsx            ← integration: render, type, tab, enter
│   ├── List.test.tsx           ← cursor navigation
│   └── Row.test.tsx            ← rendering + column alignment
└── fixtures/
    └── workspaces/             ← mock ~/.ccws/workspaces tree
```

Coverage target: >85% line coverage on `src/` modules.

### Bash side (unchanged through Phase 4)

`tests/integration/*.bats` keep running. They test the bash side which
still exists and dispatches to the binary.

A new integration test verifies the bash→binary handoff:

```bats
@test "ccws_tui_run delegates to ~/.ccws/bin/ccws-picker when present" {
    # Place a stub binary that emits 'work'
    mkdir -p "$HOME/.ccws/bin"
    cat > "$HOME/.ccws/bin/ccws-picker" <<'EOF'
#!/usr/bin/env bash
echo "work"
EOF
    chmod +x "$HOME/.ccws/bin/ccws-picker"
    run ccws_tui_run
    [[ "$output" == "work" ]]
}

@test "ccws_tui_run falls back to fzf when binary not present" {
    rm -f "$HOME/.ccws/bin/ccws-picker"
    # ... existing fzf path test ...
}
```

### CI matrix (GitHub Actions)

| Job | Runs |
|-----|------|
| `bats` | macOS + Linux × bash 3.2 + bash 5 |
| `vitest` | macOS + Linux × Bun latest |
| `build-verify` | macOS arm64, macOS x64, Linux arm64, Linux x64 (cross-compile via Bun's target flag, runs on whatever host) |
| `release` | On tag push: full build + sign + upload to GitHub Releases |

## Migration / cut-over

Phase 1 → 4: the binary is **additive**. bash `lib/tui.sh` checks for
the binary's existence and prefers it; absent → fzf fallback. No
breaking change for existing users.

Phase 5 (v1.0): the binary becomes mandatory. `bin/ccws` is replaced
with the binary (renamed). `lib/` is deleted. Users who haven't run the
install script see a `ccws: not installed — run install.sh` error in
their shell wrapper.

Communication plan:
- Phase 1 release notes mention the binary; encourage opt-in install
- Phase 2-4 release notes incrementally announce moved commands
- Phase 5 release: clear migration guide, install.sh, deprecation
  warning printed by Phase 4 binary for one release cycle

## Versioning

- Phase 1 = v0.7.0 (MINOR — new binary, no bash removal)
- Phase 2 = v0.8.0 (MINOR — new behavior in same commands)
- Phase 3 = v0.9.0 (MINOR)
- Phase 4 = v0.10.0 (MINOR)
- Phase 5 = v1.0.0 (MAJOR — bash code removed, install model changes)

Each Phase emits its own CHANGELOG entry and tag.

## Out of scope (rejected approaches)

- **Approach B: Bun + custom escape-code picker** — Reinventing fzf
  internals (cursor, resize, search) in our own code is exactly the
  kind of "death by 1000 details" that fzf taught us this week.
- **Approach C: Bun + blessed** — Older imperative API; types are
  community-maintained; React mental model is cleaner for our needs.
- **Go + bubbletea** — User specifically asked for Bun/Node ecosystem.
- **Rust + ratatui** — Same.
- **Atomic v1.0 rewrite without phasing** — Multi-week stretch where
  user still suffers the picker bugs. Phased ship lets them dogfood
  Phase 1 in days and break early if it's wrong.
- **Sibling clone instead of worktree** — Worktrees share `.git` and
  are the gstack-blessed pattern.
- **Subdir without worktree** (develop new code alongside bash in same
  checkout) — Possible, but the worktree separation gives a clear
  mental "this is dev, this is prod" boundary, and lets `git status`
  in the main checkout not show unrelated TS file noise.

## Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bun + Ink combo less stamped than Node + Ink | Medium | Low | Bun is Node-compatible; Ink works. Test early in Phase 1 spike. |
| Compiled binary too large (>100MB) | Low | Medium | Bun's `--minify` + tree-shaking. If unacceptable, fall back to npm-published JS + bunx. |
| Cross-compile fragility (Bun's target flag for linux-arm64 etc.) | Medium | Medium | Spike compile on day 1 of Phase 1. CI matrix catches regressions. |
| ccws.env round-trip loses comments/ordering | Medium | High (user data) | Parser test suite explicitly covers round-trip. Refuse to write if parse + serialize doesn't round-trip. |
| Phase 1 binary install friction for existing users | Medium | Low | Bash `lib/tui.sh` falls back to fzf if binary absent. Existing users see no change until they opt in via `ccws init` (which downloads the binary). |
| Future Phase 2-4 introduces behavior drift between bash + TS | Medium | High | Spec each phase. Integration tests on both sides until Phase 5 deletes bash. |
| Ink + Bun's React reconciler has bugs in stdin handling | Low | High | Spike day 1; have an escape hatch (raw escape codes via fallback) if blocking. |
