# ccws TUI ASCII logo

Date: 2026-05-19
Status: design accepted, pending implementation plan

## Goal

Display a 6-line ANSI Shadow ASCII logo above the interactive workspace picker
(both `fzf` and `fallback` surfaces) so that running bare `ccws` opens with a
recognizable brand mark. The logo replaces the existing one-line
`ccws · workspaces` title; the rest of the picker (rule, help row, list,
preview) is unchanged.

## Non-goals

- No animation (color cycle, fade-in). One-shot `printf` of 6 lines.
- No user-configurable logo content. The logo is a fixed visual identity.
- No change to `ccws_tui_banner` (the gum-bordered ceremonial banner used by
  `ccws init`). DESIGN.md "Surface registry" intentionally keeps ceremonial
  vs operational registers distinct.
- No logo on subcommands (`ccws use`, `list`, `add`, `doctor`, etc.). Logo
  only fires inside the TUI picker path.
- No `--header`-embedded logo. Putting it inside fzf's `--header` would eat
  picker height (already constrained by `--min-height=18` and
  `--preview-window='down,55%'`).

## Decisions (locked by brainstorming)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Scope | Only on bare `ccws` (TUI picker), both fzf and fallback engines |
| 2 | Visual style | 6-line ANSI Shadow figlet rendering of "ccws" |
| 3 | Title handling | Logo replaces `ccws · workspaces` title (no duplication) |
| 4 | Color | Per-row Catppuccin Mocha gradient: mauve → pink → lavender → sky → green → yellow |
| 5 | Render strategy | `printf` to stderr before fzf launches; logo stays in scrollback above the picker |
| 6 | Fallback parity | Numbered fallback picker also prints the logo |
| 7 | Opt-out: env var | `CCWS_NO_LOGO=1` silences the logo |
| 8 | Opt-out: width | `COLUMNS < 36` auto-hides (logo is 34 cols wide) |
| 9 | Opt-out: height | `LINES < 24` auto-hides (picker would be squeezed) |
| 10 | Opt-out: non-tty | `[[ ! -t 2 ]]` auto-hides (redirected stderr, CI, etc.) |

## Architecture

```
bin/ccws
  └─ ccws_tui_run                 (lib/tui.sh)
       ├─ ccws_tui_fzf_pick       (lib/tui_fzf.sh)
       │    └─ ccws_tui_logo  ←── NEW shared helper in lib/tui.sh
       └─ ccws_tui_fallback_pick  (lib/tui_fallback.sh)
            └─ ccws_tui_logo  ←── same call site shape
```

Single function, two call sites. The shared placement matches the existing
pattern: `CCWS_TUI_RULE`, `ccws_tui_ghost_hint`, `ccws_tui_active_index`,
`CCWS_PREVIEW_KEYS` all live in `lib/tui.sh` for the same reason — one source
of truth across all operational surfaces.

## Components

### `ccws_tui_logo` (new, in `lib/tui.sh`)

Public function. Renders the 6-line logo to stderr or returns silently if any
gate fails.

Gate order (short-circuit, cheapest first):

```bash
ccws_tui_logo() {
    [[ "${CCWS_NO_LOGO:-0}" == "1" ]] && return 0
    [[ "${CCWS_TUI_LOGO_FORCE:-0}" != "1" && ! -t 2 ]] && return 0
    local cols lines
    cols=$(_ccws_tui_cols)
    lines=$(_ccws_tui_lines)
    [[ "$cols"  -lt 36 ]] && return 0
    [[ "$lines" -lt 24 ]] && return 0
    # render
    local rs=$'\033[0m' i
    printf '\n' >&2
    for i in 0 1 2 3 4 5; do
        printf '%s%s%s\n' "${CCWS_TUI_LOGO_COLORS[i]}" "${CCWS_TUI_LOGO_LINES[i]}" "$rs" >&2
    done
    printf '\n' >&2
}
```

`CCWS_TUI_LOGO_FORCE=1` is a private test hook that bypasses the tty check
only. It is NOT documented for users; the only consumer is `tui.bats`. The
other three gates (env var, COLUMNS, LINES) remain enforced even with the
hook set, so tests still exercise gating logic by adjusting those values.

### `_ccws_tui_lines` (new, in `lib/tui.sh`)

Mirror of the existing `_ccws_tui_cols`. Same multi-source fallback chain,
same 0-treated-as-missing semantics:

```bash
_ccws_tui_lines() {
    local c=""
    if [[ -n "${LINES:-}" ]] && [[ "$LINES" =~ ^[0-9]+$ ]] && [[ "$LINES" -gt 0 ]]; then
        printf '%s\n' "$LINES"; return
    fi
    if command -v tput >/dev/null 2>&1; then
        c=$(tput lines 2>/dev/null)
        if [[ "$c" =~ ^[0-9]+$ ]] && [[ "$c" -gt 0 ]]; then
            printf '%s\n' "$c"; return
        fi
    fi
    if command -v stty >/dev/null 2>&1; then
        c=$(stty size 2>/dev/null | awk '{print $1}')
        if [[ "$c" =~ ^[0-9]+$ ]] && [[ "$c" -gt 0 ]]; then
            printf '%s\n' "$c"; return
        fi
    fi
    printf '%s\n' 24
}
```

Default 24 matches the historic VT100 terminal height — same convention as
`_ccws_tui_cols` defaulting to 80.

### Data: `CCWS_TUI_LOGO_LINES`, `CCWS_TUI_LOGO_COLORS`

Two parallel bash arrays in `lib/tui.sh`, declared and exported alongside
`CCWS_TUI_RULE` and `CCWS_PREVIEW_KEYS`.

```bash
CCWS_TUI_LOGO_COLORS=(
    $'\033[38;2;203;166;247;1m'   # mauve   #cba6f7
    $'\033[38;2;245;194;231;1m'   # pink    #f5c2e7
    $'\033[38;2;180;190;254;1m'   # lavender #b4befe
    $'\033[38;2;137;220;235;1m'   # sky     #89dceb
    $'\033[38;2;166;227;161;1m'   # green   #a6e3a1
    $'\033[38;2;249;226;175;1m'   # yellow  #f9e2af
)

CCWS_TUI_LOGO_LINES=(
    ' ██████╗ ██████╗██╗    ██╗███████╗'
    '██╔════╝██╔════╝██║    ██║██╔════╝'
    '██║     ██║     ██║ █╗ ██║███████╗'
    '██║     ██║     ██║███╗██║╚════██║'
    '╚██████╗╚██████╗╚███╔███╔╝███████║'
    ' ╚═════╝ ╚═════╝ ╚══╝╚══╝ ╚══════╝'
)
```

Colors use truecolor 24-bit ANSI + bold; each line ends with a `\033[0m`
reset to prevent attribute bleed onto the next `printf`.

### Call site: `lib/tui_fzf.sh`

Insert `ccws_tui_logo` after the empty-workspace early return (no logo on
the "no workspaces" message) and before any rendering. Then collapse the
existing 3-line header to 2 lines (rule + help), dropping the redundant
`ccws · workspaces` title:

```bash
raw=$(ccws_tui_collect_workspaces)
[[ -z "$raw" ]] && { ccws_log_info "no workspaces — run 'ccws add <name>'"; return 1; }

ccws_tui_logo   # NEW
```

```bash
local help_line="${c_dim}↑↓ navigate    type to filter    ↵ activate    PgUp/PgDn preview    esc cancel${c_rs}${ghost}"
local header_line="${c_dim}${CCWS_TUI_RULE}${c_rs}"$'\n'"$help_line"
```

The local `c_mauve_bold` variable becomes unused after the title row is
removed; remove the declaration too (verified via grep before deletion).

### Call site: `lib/tui_fallback.sh`

Insert `ccws_tui_logo` after the empty-list early return. Then remove the
existing one-line title `ccws · workspaces`, keeping only the rule:

```bash
# Before:
printf '\n%s%sccws · workspaces%s\n' "$indent" "$mauve_b" "$rs" >&2
printf '%s%s%s%s\n\n' "$indent" "$dim" "$CCWS_TUI_RULE" "$rs" >&2

# After:
ccws_tui_logo
printf '%s%s%s%s\n\n' "$indent" "$dim" "$CCWS_TUI_RULE" "$rs" >&2
```

Same grep-then-remove dance for the local `mauve_b` variable.

## Data flow

```
user runs `ccws`
      ↓
bin/ccws → ccws_tui_run
      ↓
ccws_tui_engine returns "fzf" or "fallback"
      ↓
either pick function:
  1. ccws_tui_collect_workspaces (may early-return if empty)
  2. ccws_tui_logo               ← all 4 gates checked here
  3. existing rendering (header, list, preview, prompt)
```

No I/O ordering surprises: the logo writes to stderr before fzf takes
control of the terminal. fzf opens alternate-screen mode; on exit, the
terminal returns to the main buffer where the logo (and any other
pre-fzf stderr) is still visible in the scrollback.

## Error handling

The function returns `0` on every code path. Gating misses are silent — no
warning logged. Rationale: a user on a 23-row terminal seeing a `[ccws]
LOGO_SKIP` message every time would be noise, and there is no recoverable
error here. The picker continues to work identically whether the logo
prints or not.

The function does not guard against `printf` failure. If stderr is
closed mid-write (extreme edge case), `bin/ccws`'s `set -e` would
propagate the failure. This is acceptable: a broken stderr at picker
launch is already a fatal condition. Neither call site wraps the
invocation in `|| true`; the function's last statement is a successful
`printf` to stderr, so a clean run always returns 0.

## Testing

`tests/integration/tui.bats` gains six bats cases:

1. `ccws_tui_logo respects CCWS_NO_LOGO=1` — set env var, expect empty stderr.
2. `ccws_tui_logo skips when stderr is not a tty` — bats default,
   `CCWS_TUI_LOGO_FORCE` unset, expect empty stderr.
3. `ccws_tui_logo skips when COLUMNS < 36` — `CCWS_TUI_LOGO_FORCE=1
   COLUMNS=30 LINES=40`, expect empty stderr.
4. `ccws_tui_logo skips when LINES < 24` — `CCWS_TUI_LOGO_FORCE=1
   COLUMNS=80 LINES=20`, expect empty stderr.
5. `ccws_tui_logo renders 6 lines when gates pass` —
   `CCWS_TUI_LOGO_FORCE=1 COLUMNS=80 LINES=40`, assert 6 non-empty stderr
   lines surrounded by blank lines.
6. `_ccws_tui_lines fallback chain` — mirror of the existing
   `_ccws_tui_cols falls through to default 24 when no source reports
   height` test; PATH-shim `tput`/`stty` to exit 1, unset `LINES`,
   expect `24`.

The `CCWS_TUI_LOGO_FORCE` test hook is necessary because bats stderr is a
pipe, not a tty; cases 3, 4, 5 would otherwise short-circuit on the
`[[ -t 2 ]]` gate before any width/height logic ran.

The two existing picker-level tests
(`ccws_tui_fzf_pick survives bin/ccws's set -u with empty start_bind` and
`ccws_tui_fallback_pick renders '· active' suffix`) need updating: the
old `ccws · workspaces` title is gone, so any output assertion that
referenced it must be revisited. Existing tests do not assert on title
text, so this is a no-op verification; called out here to prevent
surprise.

## Documentation

`DESIGN.md` updates:

- Add `## Logo` section: 6 lines ANSI Shadow, gradient color order,
  gating policy, replaces picker title, fallback parity.
- Update "Surface registry" table: annotate the fzf and fallback rows
  with "with logo header"; note that the ceremonial `ccws_tui_banner`
  (used by `ccws init`) remains separate and does not invoke
  `ccws_tui_logo`.
- Layout principles section: amend rule #6 ("Preview is a key/value
  table") chronology if needed — the new title row count (2 instead of
  3) does not change the preview budget, so no edit expected.

`bin/ccws` usage text: no change. The logo is a visual property of the
picker, not a user-facing command or flag.

`README.md`: no edit (per the project's "no new docs unless asked"
posture; `DESIGN.md` is the canonical internal design reference).

## bash 3.2 compatibility

The project supports macOS `/bin/bash` (3.2). Constructs used:

- `${arr[i]}` — supported.
- Numeric `for i in 0 1 2 3 4 5` literal — supported.
- `printf '%s'` with truecolor ANSI strings — supported (no `%b` used).
- Array declarations with `$'...'` ANSI-C quoting — supported in 3.2.
- No process substitution, no associative arrays, no `case` inside
  `$(...)` (the known 3.2 parser bug also flagged in `tui_fzf.sh`).
- No empty-array expansion under `set -u` — the gradient arrays always
  have 6 elements; no guard needed.

## Versioning

Per `DESIGN.md` "Versioning" rules:

- Adding the `CCWS_NO_LOGO` environment variable is a new public-facing
  knob → **MINOR bump** (e.g. 0.5.1 → 0.6.0).
- The visual change (logo + title removal) on its own would be a PATCH,
  but the env var addition dominates the version bump.

The release that ships this change includes the version bump in
`bin/ccws`'s `--version` literal.

## Out of scope (rejected approaches)

- **B. Separate `lib/tui_logo.sh` file** — one function + two arrays + one
  helper is below the threshold that justifies a new file. Would force a
  second `source` line in `tui.sh` for no isolation gain.
- **C. Inline duplication in `tui_fzf.sh` and `tui_fallback.sh`** — DRY
  violation; color or string tweaks would need to land in two places.
- **fzf `--header` mode** — eats picker height. With `--min-height=18`
  and `--preview-window='down,55%'`, a 6-row header leaves ~5 list rows
  and ~5 preview rows. Unusable.
- **Animation** — token-of-flexion that runs every `ccws` invocation
  would be noise once the novelty wears off. Logo is identity, not motion.
- **Configurable logo content** — YAGNI. If someone wants a custom logo,
  they can patch the file; the indirection cost is not justified for a
  single visual brand mark.
