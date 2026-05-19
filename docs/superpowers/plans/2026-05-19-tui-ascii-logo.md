# ccws TUI ASCII Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Print a 6-line ANSI Shadow ASCII logo above the interactive picker (fzf + fallback), replacing the existing `ccws · workspaces` title, with four opt-out gates (env var, COLUMNS<36, LINES<24, non-tty).

**Architecture:** Single shared helper `ccws_tui_logo` in `lib/tui.sh` (next to existing `CCWS_TUI_RULE` / `ccws_tui_ghost_hint` / `ccws_tui_active_index`), invoked by both `ccws_tui_fzf_pick` and `ccws_tui_fallback_pick` after the empty-list early-return. Logo writes to stderr and survives in scrollback because fzf's alternate-screen mode does not erase it. New `_ccws_tui_lines` helper mirrors the existing `_ccws_tui_cols` width-detection chain. Test hook `CCWS_TUI_LOGO_FORCE=1` bypasses the tty check only, for bats coverage.

**Tech Stack:** bash 3.2-compatible shell (macOS `/bin/bash`), truecolor ANSI escapes, fzf 0.44+, bats for tests.

**Spec reference:** `docs/superpowers/specs/2026-05-19-tui-logo-design.md` (branch `spec/tui-ascii-logo`, commit `f6ebf53`).

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `lib/tui.sh` | Shared TUI primitives, dispatcher | Modify: add `_ccws_tui_lines`, `CCWS_TUI_LOGO_LINES`, `CCWS_TUI_LOGO_COLORS`, `ccws_tui_logo` |
| `lib/tui_fzf.sh` | fzf picker rendering | Modify: call `ccws_tui_logo`, drop `ccws · workspaces` title row from header |
| `lib/tui_fallback.sh` | Numbered fallback picker | Modify: call `ccws_tui_logo`, drop title line + unused `mauve_b` local |
| `tests/integration/tui.bats` | TUI integration tests | Modify: add 7 new tests (2 for `_ccws_tui_lines`, 5 for `ccws_tui_logo`) |
| `DESIGN.md` | Visual design source of truth | Modify: add `## Logo` section, annotate Surface Registry rows |
| `bin/ccws` | Dispatcher + `--version` | Modify: bump version string `0.5.1` → `0.6.0` |

Total: 6 files modified, 0 created.

---

## Task 1: `_ccws_tui_lines` height detection helper

**Files:**
- Modify: `lib/tui.sh` (add function after existing `_ccws_tui_cols`)
- Test: `tests/integration/tui.bats` (add two cases)

This task adds the helper that `ccws_tui_logo` will use for its `LINES<24` gate. Mirrors the existing `_ccws_tui_cols` chain exactly: `$LINES` → `tput lines` → `stty size | awk '{print $1}'` → default `24`. Same 0-treated-as-missing rule.

- [ ] **Step 1: Write the failing tests**

Add these two tests at the end of `tests/integration/tui.bats` (after the existing `_ccws_tui_cols` tests, before the `ccws_tui_fzf_pick survives bin/ccws's set -u` regression test so the new tests group with their sibling):

```bash
@test "_ccws_tui_lines honors exported LINES when valid" {
    export LINES=42
    run _ccws_tui_lines
    [[ "$output" == "42" ]]
}

@test "_ccws_tui_lines falls through to default 24 when no source reports height" {
    # PATH-shim tput/stty to exit non-zero, unset LINES, expect default.
    local shim_dir="$BATS_TMPDIR/lines-none-$$-$RANDOM"
    mkdir -p "$shim_dir"
    cat > "$shim_dir/tput" <<'SHIM'
#!/usr/bin/env bash
exit 1
SHIM
    cat > "$shim_dir/stty" <<'SHIM'
#!/usr/bin/env bash
exit 1
SHIM
    chmod +x "$shim_dir/tput" "$shim_dir/stty"
    unset LINES
    PATH="$shim_dir" run _ccws_tui_lines
    [[ "$output" == "24" ]]
    rm -rf "$shim_dir"
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/kola/workspace/ccws
bats tests/integration/tui.bats -f "_ccws_tui_lines"
```

Expected: 2 failures, `_ccws_tui_lines: command not found`.

- [ ] **Step 3: Implement `_ccws_tui_lines` in `lib/tui.sh`**

Locate the existing `_ccws_tui_cols()` function (currently at line 94). Insert the new function directly after its closing brace (which is on the line that just contains `}` before `# Returns 0 (success) when fzf reports ≥ 0.44.`):

```bash
# Multi-source terminal height detection. Mirrors _ccws_tui_cols exactly:
# $LINES isn't always exported into subprocesses, so fall back to tput, then
# stty, then a default of 24 (the historic VT100 row count, matching the
# 80-col default in _ccws_tui_cols). A reported height of 0 is treated as
# missing and falls through to the next source — same rule as _ccws_tui_cols.
_ccws_tui_lines() {
    local c=""
    if [[ -n "${LINES:-}" ]] && [[ "$LINES" =~ ^[0-9]+$ ]] && [[ "$LINES" -gt 0 ]]; then
        printf '%s\n' "$LINES"
        return
    fi
    if command -v tput >/dev/null 2>&1; then
        c=$(tput lines 2>/dev/null)
        if [[ "$c" =~ ^[0-9]+$ ]] && [[ "$c" -gt 0 ]]; then
            printf '%s\n' "$c"
            return
        fi
    fi
    if command -v stty >/dev/null 2>&1; then
        c=$(stty size 2>/dev/null | awk '{print $1}')
        if [[ "$c" =~ ^[0-9]+$ ]] && [[ "$c" -gt 0 ]]; then
            printf '%s\n' "$c"
            return
        fi
    fi
    printf '%s\n' 24
}
```

Also update the file header docstring (the block starting `# Interactive TUI dispatcher + shared helpers.`). Add this line right after the existing `#   _ccws_tui_cols           → terminal column count from $COLUMNS / tput / stty` line:

```
#   _ccws_tui_lines          → terminal row count from $LINES / tput / stty
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/kola/workspace/ccws
bats tests/integration/tui.bats -f "_ccws_tui_lines"
```

Expected: 2 passes.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```bash
cd /Users/kola/workspace/ccws
bats tests/integration/tui.bats
```

Expected: all existing tests still pass plus the 2 new ones (count = old count + 2).

- [ ] **Step 6: Commit**

```bash
cd /Users/kola/workspace/ccws
git add lib/tui.sh tests/integration/tui.bats
git commit -m "feat(tui): add _ccws_tui_lines height detection helper

Mirrors _ccws_tui_cols. Same multi-source fallback chain (\$LINES →
tput lines → stty size → default 24). Will be used by the upcoming
logo helper to gate on terminal height.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Logo data + `ccws_tui_logo` function with all four gates

**Files:**
- Modify: `lib/tui.sh` (add two arrays + `ccws_tui_logo` function)
- Test: `tests/integration/tui.bats` (add five gate/render tests)

This is the core feature. Logo data lives as two parallel bash arrays. The function applies four short-circuit gates then renders the 6 lines to stderr.

- [ ] **Step 1: Write the failing tests**

Append these five tests to `tests/integration/tui.bats`, right after the `_ccws_tui_lines` tests added in Task 1:

```bash
@test "ccws_tui_logo respects CCWS_NO_LOGO=1" {
    # Highest-priority gate. Set every other gate to "would render" to prove
    # CCWS_NO_LOGO=1 alone suppresses output.
    export CCWS_NO_LOGO=1
    export CCWS_TUI_LOGO_FORCE=1
    export COLUMNS=80
    export LINES=40
    run ccws_tui_logo
    [[ "$status" -eq 0 ]]
    [[ -z "$output" ]]
}

@test "ccws_tui_logo skips when stderr is not a tty" {
    # bats stderr is a pipe by default. Without CCWS_TUI_LOGO_FORCE, the
    # [[ -t 2 ]] gate must short-circuit.
    unset CCWS_NO_LOGO
    unset CCWS_TUI_LOGO_FORCE
    export COLUMNS=80
    export LINES=40
    run ccws_tui_logo
    [[ "$status" -eq 0 ]]
    [[ -z "$output" ]]
}

@test "ccws_tui_logo skips when COLUMNS<36" {
    unset CCWS_NO_LOGO
    export CCWS_TUI_LOGO_FORCE=1
    export COLUMNS=30
    export LINES=40
    run ccws_tui_logo
    [[ "$status" -eq 0 ]]
    [[ -z "$output" ]]
}

@test "ccws_tui_logo skips when LINES<24" {
    unset CCWS_NO_LOGO
    export CCWS_TUI_LOGO_FORCE=1
    export COLUMNS=80
    export LINES=20
    run ccws_tui_logo
    [[ "$status" -eq 0 ]]
    [[ -z "$output" ]]
}

@test "ccws_tui_logo renders 6 logo lines when gates pass" {
    # Run under bash -c so we control the env precisely. Capture combined
    # stdout+stderr because the logo writes to stderr.
    run bash -c "
        export CCWS_TUI_LOGO_FORCE=1
        export COLUMNS=80
        export LINES=40
        unset CCWS_NO_LOGO
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui.sh'
        ccws_tui_logo 2>&1
    "
    [[ "$status" -eq 0 ]]
    # 6 logo lines surrounded by 1 blank line above and 1 below.
    # Count lines containing the box-drawing block char (█), which only
    # appears in the logo. Each of the 6 logo rows contains at least one.
    local count
    count=$(printf '%s\n' "$output" | grep -c '█')
    [[ "$count" -eq 6 ]]
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/kola/workspace/ccws
bats tests/integration/tui.bats -f "ccws_tui_logo"
```

Expected: 5 failures, `ccws_tui_logo: command not found`.

- [ ] **Step 3: Add the data arrays to `lib/tui.sh`**

Locate the existing `CCWS_TUI_RULE='────────────────────────────────'` declaration (currently around line 54, just after `CCWS_PREVIEW_KEYS` and its `export`). Add these declarations directly after `export CCWS_TUI_RULE`:

```bash
# ASCII logo printed above the picker. Two parallel arrays: per-row truecolor
# ANSI + bold escapes, and the 6 raw lines of the figlet (ANSI Shadow font of
# "ccws"). Both have exactly 6 elements; ccws_tui_logo's render loop trusts
# that contract. To recolor or restyle the logo, edit these arrays only — the
# loop body and the gates never need to change.
CCWS_TUI_LOGO_COLORS=(
    $'\033[38;2;203;166;247;1m'   # mauve   #cba6f7
    $'\033[38;2;245;194;231;1m'   # pink    #f5c2e7
    $'\033[38;2;180;190;254;1m'   # lavender #b4befe
    $'\033[38;2;137;220;235;1m'   # sky     #89dceb
    $'\033[38;2;166;227;161;1m'   # green   #a6e3a1
    $'\033[38;2;249;226;175;1m'   # yellow  #f9e2af
)
export CCWS_TUI_LOGO_COLORS

CCWS_TUI_LOGO_LINES=(
    ' ██████╗ ██████╗██╗    ██╗███████╗'
    '██╔════╝██╔════╝██║    ██║██╔════╝'
    '██║     ██║     ██║ █╗ ██║███████╗'
    '██║     ██║     ██║███╗██║╚════██║'
    '╚██████╗╚██████╗╚███╔███╔╝███████║'
    ' ╚═════╝ ╚═════╝ ╚══╝╚══╝ ╚══════╝'
)
export CCWS_TUI_LOGO_LINES
```

- [ ] **Step 4: Add the `ccws_tui_logo` function to `lib/tui.sh`**

Insert the function directly after `_ccws_tui_lines` (added in Task 1) and before the existing `# Returns 0 (success) when fzf reports ≥ 0.44.` comment block:

```bash
# Print the 6-line ANSI Shadow ASCII logo to stderr, or return silently if
# any gate fails. Gates (short-circuit, cheapest first):
#   1. CCWS_NO_LOGO=1            — user opt-out
#   2. stderr is not a tty       — redirected / CI / non-interactive
#   3. COLUMNS < 36              — logo is 34 cols wide, no point cramming
#   4. LINES < 24                — would squeeze the picker off-screen
#
# CCWS_TUI_LOGO_FORCE=1 bypasses the tty check ONLY, for bats coverage of
# the size gates. Not documented for end users.
ccws_tui_logo() {
    [[ "${CCWS_NO_LOGO:-0}" == "1" ]] && return 0
    if [[ "${CCWS_TUI_LOGO_FORCE:-0}" != "1" ]] && [[ ! -t 2 ]]; then
        return 0
    fi
    local cols lines
    cols=$(_ccws_tui_cols)
    lines=$(_ccws_tui_lines)
    [[ "$cols"  -lt 36 ]] && return 0
    [[ "$lines" -lt 24 ]] && return 0

    local rs=$'\033[0m' i
    printf '\n' >&2
    for i in 0 1 2 3 4 5; do
        printf '%s%s%s\n' "${CCWS_TUI_LOGO_COLORS[i]}" "${CCWS_TUI_LOGO_LINES[i]}" "$rs" >&2
    done
    printf '\n' >&2
}
```

Also update the file header docstring. Find the comment block listing helpers (it starts `# All TUI surfaces (fzf, fallback, gum) share visual vocabulary from DESIGN.md.`). Add this line after the existing `#   _ccws_tui_lines          → terminal row count from $LINES / tput / stty` (added in Task 1):

```
#   ccws_tui_logo            → print 6-line ANSI Shadow logo to stderr (gated)
#   CCWS_TUI_LOGO_LINES      → 6 raw figlet lines (parallel to CCWS_TUI_LOGO_COLORS)
#   CCWS_TUI_LOGO_COLORS     → 6 truecolor ANSI escapes for the gradient
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/kola/workspace/ccws
bats tests/integration/tui.bats -f "ccws_tui_logo"
```

Expected: 5 passes.

- [ ] **Step 6: Run the full test suite to confirm no regressions**

```bash
cd /Users/kola/workspace/ccws
bats tests/integration/tui.bats
```

Expected: all tests pass (count = previous total + 5).

- [ ] **Step 7: Commit**

```bash
cd /Users/kola/workspace/ccws
git add lib/tui.sh tests/integration/tui.bats
git commit -m "feat(tui): add ccws_tui_logo with four opt-out gates

Six-line ANSI Shadow rendering of 'ccws', per-row Catppuccin gradient
(mauve → pink → lavender → sky → green → yellow). Gates: CCWS_NO_LOGO=1,
stderr-not-a-tty, COLUMNS<36, LINES<24. CCWS_TUI_LOGO_FORCE=1 is a
private test hook that bypasses the tty check only.

Not yet wired into the pickers — that lands in the next two commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Wire logo into fzf picker, remove duplicate title

**Files:**
- Modify: `lib/tui_fzf.sh` (insert call site, collapse header from 3 lines to 2)

The logo replaces the `ccws · workspaces` title row. Header becomes 2 lines: the 32-char dim rule, then the help line.

- [ ] **Step 1: Insert the `ccws_tui_logo` call in `lib/tui_fzf.sh`**

Locate this block at the top of `ccws_tui_fzf_pick()` (currently around lines 18-21):

```bash
ccws_tui_fzf_pick() {
    local raw
    raw=$(ccws_tui_collect_workspaces)
    [[ -z "$raw" ]] && { ccws_log_info "no workspaces — run 'ccws add <name>'"; return 1; }
```

Insert one line directly after the empty-check (so the logo does NOT print on the "no workspaces" early return — that path is a guidance message, not the picker):

```bash
ccws_tui_fzf_pick() {
    local raw
    raw=$(ccws_tui_collect_workspaces)
    [[ -z "$raw" ]] && { ccws_log_info "no workspaces — run 'ccws add <name>'"; return 1; }

    ccws_tui_logo
```

- [ ] **Step 2: Collapse the header from 3 lines to 2**

Locate the existing 3-line header construction (currently around lines 179-182):

```bash
local ghost
ghost=$(ccws_tui_ghost_hint)
local help_line="${c_dim}↑↓ navigate    type to filter    ↵ activate    PgUp/PgDn preview    esc cancel${c_rs}${ghost}"
local header_line="${c_mauve_bold}ccws · workspaces${c_rs}"$'\n'"${c_dim}${CCWS_TUI_RULE}${c_rs}"$'\n'"$help_line"
```

Replace the `header_line=...` assignment so the title row is gone and only the rule + help remain:

```bash
local ghost
ghost=$(ccws_tui_ghost_hint)
local help_line="${c_dim}↑↓ navigate    type to filter    ↵ activate    PgUp/PgDn preview    esc cancel${c_rs}${ghost}"
local header_line="${c_dim}${CCWS_TUI_RULE}${c_rs}"$'\n'"$help_line"
```

- [ ] **Step 3: Confirm `c_mauve_bold` is unused, remove its declaration**

Search for any remaining references to `c_mauve_bold` in `lib/tui_fzf.sh`:

```bash
cd /Users/kola/workspace/ccws
grep -n c_mauve_bold lib/tui_fzf.sh
```

Expected: one hit — the declaration `local c_mauve_bold=$'\033[38;2;203;166;247;1m'` around line 35.

If that is the only hit, delete the declaration line.

If there are other hits, do NOT delete it — investigate why before proceeding.

- [ ] **Step 4: Also update the file comment header block**

Locate the comment block at the top of `lib/tui_fzf.sh` (lines 1-15). The current text mentions a `--header` with title and rule. Update the relevant phrasing so it describes the new 2-line header. Find this line:

```
# rule rendered in --header. List rows have no pointer marker — fzf's cursor
```

The full block currently reads "Layout: no outer frame. Indent via --margin='1,8,1,8'. Title line + 32-char rule rendered in --header." But the actual code now uses no `--margin`, just flush-left. Replace lines 3-5 (the `# Layout:` block) with:

```
# Layout: no outer frame, flush-left, terminal-native background. Picker
# header is a 2-line block: 32-char dim rule + help line (title slot is
# served by the ASCII logo printed via ccws_tui_logo before fzf launches).
# List rows have no pointer marker — fzf's cursor (--pointer="❯") is the
# only ❯ on screen. Active workspace is signaled by green-bold name color
# + a dim "· active" suffix (color is the primary signal, the suffix
# preserves the cue for colorblind users).
```

- [ ] **Step 5: Run the full bats suite to verify no regressions**

```bash
cd /Users/kola/workspace/ccws
bats tests/integration/tui.bats
```

Expected: all tests pass. Pay attention to the existing `ccws_tui_fzf_pick survives bin/ccws's set -u with empty start_bind array (bash 3.2 regression)` test — it stubs `fzf` as a shell function, so it must still pass even though the picker code path now also invokes `ccws_tui_logo` (which is gated and will skip silently in bats).

- [ ] **Step 6: Manual smoke test (one-shot, optional but recommended)**

In a real terminal (must be a tty wider than 36 cols and taller than 24 rows):

```bash
cd /Users/kola/workspace/ccws
bin/ccws
```

Expected: 6-line gradient logo appears above the picker; the dim 32-char rule and the help row appear directly below the logo; the `ccws · workspaces` text is gone. Press Esc — the logo remains visible in the scrollback above the prompt.

Also test the opt-out:

```bash
CCWS_NO_LOGO=1 bin/ccws
```

Expected: no logo, picker opens directly with just the rule + help header.

- [ ] **Step 7: Commit**

```bash
cd /Users/kola/workspace/ccws
git add lib/tui_fzf.sh
git commit -m "feat(tui): wire ccws_tui_logo into fzf picker

Logo prints above fzf and survives in scrollback (alternate-screen
mode leaves the main buffer intact). The picker's own 'ccws · workspaces'
title row is removed — the logo IS the title now. Header collapses
from 3 lines to 2 (rule + help).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Wire logo into fallback picker, remove duplicate title

**Files:**
- Modify: `lib/tui_fallback.sh` (insert call site, drop title line + unused `mauve_b` local)

The fallback picker is the operational mirror of fzf (DESIGN.md "Surface registry"). It gets the same logo treatment — call `ccws_tui_logo` after the empty-list early return, then keep only the rule line of the existing header.

- [ ] **Step 1: Insert the `ccws_tui_logo` call**

Locate this block at the top of `ccws_tui_fallback_pick()` (currently around lines 10-18):

```bash
ccws_tui_fallback_pick() {
    local lines=()
    while IFS= read -r line; do
        lines+=("$line")
    done < <(ccws_tui_collect_workspaces)
    if [[ "${#lines[@]}" -eq 0 ]]; then
        ccws_log_info "no workspaces — run 'ccws add <name>' first"
        return 1
    fi
```

Insert one line directly after the empty-list early return:

```bash
ccws_tui_fallback_pick() {
    local lines=()
    while IFS= read -r line; do
        lines+=("$line")
    done < <(ccws_tui_collect_workspaces)
    if [[ "${#lines[@]}" -eq 0 ]]; then
        ccws_log_info "no workspaces — run 'ccws add <name>' first"
        return 1
    fi

    ccws_tui_logo
```

- [ ] **Step 2: Drop the title line, keep the rule**

Locate the existing title + rule block (currently around lines 33-35):

```bash
printf '\n%s%sccws · workspaces%s\n' "$indent" "$mauve_b" "$rs" >&2
printf '%s%s%s%s\n\n' "$indent" "$dim" "$CCWS_TUI_RULE" "$rs" >&2
```

Delete the first `printf` (the title line). Keep only the rule line:

```bash
printf '%s%s%s%s\n\n' "$indent" "$dim" "$CCWS_TUI_RULE" "$rs" >&2
```

The `\n` at the start of the original first line gave a blank above the title. `ccws_tui_logo` already prints a trailing blank line, so no further blank-line bookkeeping is needed.

- [ ] **Step 3: Confirm `mauve_b` is unused, remove its declaration**

Search for any remaining references to `mauve_b` in `lib/tui_fallback.sh`:

```bash
cd /Users/kola/workspace/ccws
grep -n mauve_b lib/tui_fallback.sh
```

Expected: one hit — the declaration `local mauve_b=$'\033[38;2;203;166;247;1m'` around line 21.

If that is the only hit, delete the declaration line.

If there are other hits, investigate before proceeding.

- [ ] **Step 4: Update the file comment header**

Locate the comment block at the top of `lib/tui_fallback.sh` (lines 1-8). The current text says "Mirrors the fzf picker's visual language: 32-char rule, ~8-col indent, no opening/closing list rules, no in-row pointer marker." Replace lines 3-8 with:

```
# Used when fzf is not installed, fzf < 0.44, COLUMNS < 60, or CCWS_NO_TUI=1.
# Mirrors the fzf picker's visual language: ASCII logo above (via
# ccws_tui_logo), 32-char rule, no opening/closing list rules, no in-row
# pointer marker. The numbered prefix (1), 2)...) stays since that's how the
# user inputs the selection. See DESIGN.md "Surface registry" for the
# cross-engine alignment rules.
```

- [ ] **Step 5: Run the full bats suite to verify no regressions**

```bash
cd /Users/kola/workspace/ccws
bats tests/integration/tui.bats
```

Expected: all tests pass. The existing `ccws_tui_fallback_pick renders '· active' suffix for active workspace` test asserts on the `· active` suffix in stderr; the logo helper is gated (bats stderr is not a tty), so it remains silent during the test and does not interfere with the suffix assertion.

- [ ] **Step 6: Manual smoke test (one-shot, recommended)**

Force the fallback engine and verify:

```bash
cd /Users/kola/workspace/ccws
CCWS_NO_TUI=1 bin/ccws
```

Expected: 6-line gradient logo, then rule, then numbered list of workspaces, then the `number to select  q to quit :` prompt. Type `q` Enter to exit.

```bash
CCWS_NO_TUI=1 CCWS_NO_LOGO=1 bin/ccws
```

Expected: no logo, just the rule + numbered list + prompt.

- [ ] **Step 7: Commit**

```bash
cd /Users/kola/workspace/ccws
git add lib/tui_fallback.sh
git commit -m "feat(tui): wire ccws_tui_logo into fallback picker

Mirrors the fzf wiring: logo above the picker, no duplicated 'ccws ·
workspaces' title. Operational surface parity per DESIGN.md 'Surface
registry'. The unused mauve_b local is dropped too.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Document the logo in `DESIGN.md`

**Files:**
- Modify: `DESIGN.md` (add `## Logo` section, annotate Surface Registry table)

`DESIGN.md` is the project's design source of truth (per the user's "no new docs unless asked" rule, no README change). The logo gets its own section and the surface registry rows for fzf and fallback get annotated.

- [ ] **Step 1: Add the `## Logo` section**

Locate the `## Preview` section header in `DESIGN.md` (currently around line 64). Insert a new `## Logo` section directly BEFORE `## Preview`:

```markdown
## Logo

The interactive picker (both fzf and fallback engines) opens with a 6-line
ANSI Shadow ASCII rendering of "ccws", written to stderr above the picker
by the shared helper `ccws_tui_logo` in `lib/tui.sh`. The logo replaces
the picker's title row — the rule + help row stay, but there is no
`ccws · workspaces` text any more.

**Color:** per-row Catppuccin Mocha gradient, top to bottom:
mauve `#cba6f7` → pink `#f5c2e7` → lavender `#b4befe` → sky `#89dceb`
→ green `#a6e3a1` → yellow `#f9e2af`. All rows are bold.

**Gates (any one suppresses the logo silently):**

| Gate | Trigger | Why |
|------|---------|-----|
| `CCWS_NO_LOGO=1` | User opt-out | Some users prefer the picker without branding |
| stderr is not a tty | Redirected, piped, CI | Logo bytes would corrupt machine-readable output |
| `COLUMNS < 36` | Narrow terminal | Logo is 34 cols wide; cramming it line-wraps to nonsense |
| `LINES < 24` | Short terminal | Picker (`--min-height=18`) plus logo would scroll off-screen |

The render lives in scrollback because fzf's alternate-screen mode does
not erase the main buffer. After Esc, the logo remains visible above the
prompt.

The ceremonial banner (`ccws_tui_banner` in `lib/tui_gum.sh`, used by
`ccws init`) is a separate surface and does NOT call `ccws_tui_logo` —
see the Surface Registry below.
```

- [ ] **Step 2: Annotate the Surface Registry table**

Locate the Surface Registry table in `DESIGN.md` (currently around lines 81-85). Update the three rows so the logo posture is explicit:

Find:

```markdown
| Surface | Register | Frame | Why |
|---------|----------|-------|-----|
| `ccws_tui_fzf_pick` (`lib/tui_fzf.sh`) | Operational | None | High-frequency daily use. Restraint earns its place by getting out of the way. |
| `ccws_tui_fallback_pick` (`lib/tui_fallback.sh`) | Operational | None | Mirror of the fzf register for narrow terminals / no-fzf / `CCWS_NO_TUI=1`. |
| `ccws_tui_banner` (`lib/tui_gum.sh`) | Ceremonial | Double border (gum) | One-time first-run welcome via `ccws init`. Attention budget is high, the moment carries weight, a bordered banner earns its presence. |
```

Replace with:

```markdown
| Surface | Register | Frame | Logo | Why |
|---------|----------|-------|------|-----|
| `ccws_tui_fzf_pick` (`lib/tui_fzf.sh`) | Operational | None | ASCII logo above (via `ccws_tui_logo`) | High-frequency daily use. Restraint earns its place by getting out of the way. |
| `ccws_tui_fallback_pick` (`lib/tui_fallback.sh`) | Operational | None | ASCII logo above (via `ccws_tui_logo`) | Mirror of the fzf register for narrow terminals / no-fzf / `CCWS_NO_TUI=1`. |
| `ccws_tui_banner` (`lib/tui_gum.sh`) | Ceremonial | Double border (gum) | No (the gum banner IS the brand mark) | One-time first-run welcome via `ccws init`. Attention budget is high, the moment carries weight, a bordered banner earns its presence. |
```

- [ ] **Step 3: Verify the markdown renders cleanly**

```bash
cd /Users/kola/workspace/ccws
grep -nE '^##|^\|' DESIGN.md | head -30
```

Expected: section headers in order are `## Colors`, `## Glyphs`, `## Layout principles`, `## Logo`, `## Preview`, `## Surface registry`, `## Versioning`, `## Reference visual languages`. The Surface Registry table has 5 columns (with the new "Logo" column).

- [ ] **Step 4: Commit**

```bash
cd /Users/kola/workspace/ccws
git add DESIGN.md
git commit -m "docs(design): document the ASCII logo and gating policy

Adds a Logo section to DESIGN.md covering the 6-line ANSI Shadow
rendering, the Catppuccin gradient, and the four opt-out gates.
Updates the Surface Registry table to make the per-surface logo
posture explicit (operational pickers get the logo, the ceremonial
gum banner does not).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Version bump in `bin/ccws`

**Files:**
- Modify: `bin/ccws` (one-line version string change)

Per the spec's Versioning section: adding the `CCWS_NO_LOGO` environment variable is a new public-facing knob, which is a MINOR bump per `DESIGN.md` "Versioning" rules. Current version `0.5.1` → new version `0.6.0`.

- [ ] **Step 1: Bump the version literal**

Open `bin/ccws`. Locate the version case branch (currently around line 116):

```bash
--version|-V) echo "ccws 0.5.1"; exit 0 ;;
```

Change to:

```bash
--version|-V) echo "ccws 0.6.0"; exit 0 ;;
```

- [ ] **Step 2: Verify the version reports correctly**

```bash
cd /Users/kola/workspace/ccws
bin/ccws --version
```

Expected output: `ccws 0.6.0`

- [ ] **Step 3: Commit**

```bash
cd /Users/kola/workspace/ccws
git add bin/ccws
git commit -m "chore: bump version to 0.6.0

CCWS_NO_LOGO env var is a new public-facing knob per DESIGN.md
versioning rules → MINOR bump from 0.5.1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final Verification

After all 6 tasks are committed, run a complete check:

- [ ] **Run the full bats suite one more time:**

```bash
cd /Users/kola/workspace/ccws
bats tests/integration/tui.bats
```

Expected: all tests pass, total = previous count + 7 (2 from Task 1, 5 from Task 2).

- [ ] **Verify the branch state:**

```bash
cd /Users/kola/workspace/ccws
git log --oneline spec/tui-ascii-logo..HEAD
```

Expected: 6 commits on top of the spec commit, in order:

```
chore: bump version to 0.6.0
docs(design): document the ASCII logo and gating policy
feat(tui): wire ccws_tui_logo into fallback picker
feat(tui): wire ccws_tui_logo into fzf picker
feat(tui): add ccws_tui_logo with four opt-out gates
feat(tui): add _ccws_tui_lines height detection helper
```

- [ ] **Manual end-to-end smoke test:**

1. `bin/ccws` — logo above fzf picker, no `ccws · workspaces` title, Esc leaves logo in scrollback.
2. `CCWS_NO_LOGO=1 bin/ccws` — no logo, picker opens directly.
3. `CCWS_NO_TUI=1 bin/ccws` — logo above fallback numbered menu.
4. `CCWS_NO_TUI=1 CCWS_NO_LOGO=1 bin/ccws` — no logo, fallback opens directly.
5. Open a terminal/tmux pane narrower than 36 cols, run `bin/ccws` — no logo, fallback fires (because COLUMNS<60 routes to fallback anyway).
6. Open a terminal shorter than 24 rows, run `bin/ccws` — no logo.
