#!/usr/bin/env bats

load ../helpers/setup
load ../helpers/fake_home

setup() {
    setup_fake_home
    ccws_source common.sh
    ccws_source env.sh
    ccws_source lock.sh
    ccws_source symlink_farm.sh
    ccws_source cmd_add.sh
    ccws_source cmd_toggle_danger.sh
    ccws_source tui.sh
    ccws_source tui_fallback.sh

    ccws_cmd_add work
    ccws_cmd_add personal
}

teardown() {
    teardown_fake_home
}

@test "ccws_tui_collect_workspaces lists all workspaces with metadata" {
    run ccws_tui_collect_workspaces
    [[ "$output" == *"work"* ]]
    [[ "$output" == *"personal"* ]]
}

@test "ccws_tui_collect_workspaces includes proxy field" {
    # add a workspace with proxy
    ccws_cmd_add proxied --proxy "http://127.0.0.1:7890" --non-interactive
    run ccws_tui_collect_workspaces
    # proxied row has "on", others have "off"
    echo "$output" | grep "proxied" | grep -q " on "
    echo "$output" | grep "work" | grep -q " off "
}

@test "ccws_tui_collect_workspaces emits dangerous=off by default" {
    run ccws_tui_collect_workspaces
    # 5-field format: name | endpoint | proxy | dangerous | mtime.
    # Fresh `ccws add` workspaces have no CCWS_DANGEROUS in ccws.env →
    # dangerous=off.
    [[ "$(echo "$output" | grep work    | awk -F'\\|' '{gsub(/ /, "", $4); print $4}')" == "off" ]]
    [[ "$(echo "$output" | grep personal | awk -F'\\|' '{gsub(/ /, "", $4); print $4}')" == "off" ]]
}

@test "ccws_env_set / ccws_env_is_dangerous toggle CCWS_DANGEROUS correctly" {
    # Initially off
    ! ccws_env_is_dangerous work
    # Set to 1, expect on
    ccws_env_set work CCWS_DANGEROUS 1
    ccws_env_is_dangerous work
    # Set to 0, expect off
    ccws_env_set work CCWS_DANGEROUS 0
    ! ccws_env_is_dangerous work
}

@test "ccws_cmd_toggle_danger flips the workspace flag (round-trip)" {
    # Round-trip: not-set → on → off.
    ! ccws_env_is_dangerous work
    ccws_cmd_toggle_danger work
    ccws_env_is_dangerous work
    ccws_cmd_toggle_danger work
    ! ccws_env_is_dangerous work
}

@test "ccws_cmd_toggle_danger accepts an ANSI-colored row (fzf {} substitution)" {
    # The picker passes fzf's {} which contains ANSI escapes. The command
    # must strip ANSI and pull the name from the first whitespace-separated
    # token.
    local ansi=$'\033[38;2;245;194;231mwork        \033[0m  \033[38;2;137;220;235manthropic   \033[0m  \033[38;2;108;112;134m○ direct\033[0m'
    ccws_cmd_toggle_danger "$ansi"
    ccws_env_is_dangerous work
}

@test "ccws_tui_short_endpoint normalizes URLs to short labels" {
    run ccws_tui_short_endpoint "https://api.anthropic.com"
    [[ "$output" == "anthropic" ]]

    run ccws_tui_short_endpoint ""
    [[ "$output" == "anthropic" ]]

    run ccws_tui_short_endpoint "https://api.deepseek.com/anthropic"
    [[ "$output" == "deepseek-gw" ]]

    run ccws_tui_short_endpoint "https://api.openai.com"
    [[ "$output" == "openai-gw" ]]

    run ccws_tui_short_endpoint "https://claude-proxy.example.internal"
    [[ "$output" == "claude-proxy.example.internal" ]]

    # URL with path strips path
    run ccws_tui_short_endpoint "https://gateway.example.com/v1/api"
    [[ "$output" == "gateway.example.com" ]]
}

@test "ccws_tui_truncate fits a string to N columns with ellipsis" {
    run ccws_tui_truncate "shortname" 20
    [[ "$output" == "shortname" ]]

    run ccws_tui_truncate "this-is-a-rather-long-host.example.com" 20
    [[ ${#output} -le 20 ]]
    [[ "$output" == *"…" ]]
}

@test "ccws_tui_collect_workspaces returns empty when no workspaces" {
    rm -rf "$HOME/.ccws"
    run ccws_tui_collect_workspaces
    [[ -z "$output" ]]
}

@test "ccws_tui_fallback_pick echoes selection from stdin (numbered menu)" {
    # User picks #1
    result=$(printf '1\n' | bash -c "
        export HOME='$HOME'
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui_fallback.sh'
        ccws_tui_fallback_pick
    ")
    [[ "$result" == *"work"* ]] || [[ "$result" == *"personal"* ]]
}

@test "ccws_tui_engine prefers fzf when available, else fallback" {
    if command -v fzf >/dev/null 2>&1; then
        run ccws_tui_engine
        [[ "$output" == "fzf" ]]
    else
        run ccws_tui_engine
        [[ "$output" == "fallback" ]]
    fi
}

@test "ccws_tui_engine routes to fallback when CCWS_NO_TUI=1" {
    # CCWS_NO_TUI=1 means "I don't want / can't have fzf — use the simple
    # numbered menu." Same routing as "fzf not installed". Previous version
    # routed to a "disabled" state that returned 1 silently — confusing for
    # users running `CCWS_NO_TUI=1 ccws` to test the fallback.
    export CCWS_NO_TUI=1
    run ccws_tui_engine
    [[ "$output" == "fallback" ]]
}

# --- ET10: IRON RULE regression tests for new ccws_tui_engine branches ---

@test "ccws_tui_engine returns fallback when COLUMNS<60 (DR-9)" {
    export COLUMNS=50
    run ccws_tui_engine
    [[ "$output" == "fallback" ]]
}

@test "ccws_tui_engine returns fzf when COLUMNS>=60 and fzf present (DR-9 negative)" {
    export COLUMNS=120
    if command -v fzf >/dev/null 2>&1 && _ccws_fzf_min_version; then
        run ccws_tui_engine
        [[ "$output" == "fzf" ]]
    else
        skip "needs fzf >=0.44 installed"
    fi
}

@test "ccws_tui_engine returns fallback when fzf <0.44 via PATH shim (ER-A1)" {
    # Build a fake fzf binary that reports an old version, prepend to PATH.
    local shim_dir="$BATS_TMPDIR/fzf-old-$$-$RANDOM"
    mkdir -p "$shim_dir"
    cat > "$shim_dir/fzf" <<'SHIM'
#!/usr/bin/env bash
[[ "$1" == "--version" ]] && { echo "0.42.0 (e60a76b)"; exit 0; }
echo "fake fzf shouldn't be invoked for picking in this test" >&2
exit 1
SHIM
    chmod +x "$shim_dir/fzf"
    export PATH="$shim_dir:$PATH"
    export COLUMNS=120
    # Verify the version helper sees the shimmed version
    run _ccws_fzf_min_version
    [[ "$status" -ne 0 ]]
    # And that the engine routes to fallback as a result
    run ccws_tui_engine
    [[ "$output" == "fallback" ]]
    rm -rf "$shim_dir"
}

# --- ET9: ccws_tui_ghost_hint coverage ---

@test "ccws_tui_ghost_hint returns empty when CCWS_NAME unset" {
    unset CCWS_NAME
    run ccws_tui_ghost_hint
    [[ -z "$output" ]]
}

@test "ccws_tui_ghost_hint returns empty when CCWS_NAME points at existing workspace" {
    export CCWS_NAME=work
    run ccws_tui_ghost_hint
    [[ -z "$output" ]]
}

@test "ccws_tui_ghost_hint returns hint when CCWS_NAME points at missing workspace" {
    export CCWS_NAME=deleted-workspace
    run ccws_tui_ghost_hint
    [[ -n "$output" ]]
    [[ "$output" == *"deleted-workspace"* ]]
    [[ "$output" == *"set but workspace not found"* ]]
}

# --- ET9: ccws_tui_active_index coverage ---

@test "ccws_tui_active_index returns -1 when CCWS_NAME unset" {
    unset CCWS_NAME
    run ccws_tui_active_index
    [[ "$output" == "-1" ]]
}

@test "ccws_tui_active_index returns -1 when CCWS_NAME doesn't match any workspace" {
    export CCWS_NAME=nonexistent
    run ccws_tui_active_index
    [[ "$output" == "-1" ]]
}

@test "ccws_tui_active_index returns 0-indexed position of matching workspace" {
    export CCWS_NAME=work
    run ccws_tui_active_index
    [[ "$output" =~ ^[0-9]+$ ]]
    # work is added before personal in setup(); whichever directory iteration
    # order resolves to should be a non-negative integer.
    [[ "$output" -ge 0 ]]
}

# --- ET9: CCWS_PREVIEW_KEYS data integrity ---

@test "CCWS_PREVIEW_KEYS is non-empty and every entry has env|label form" {
    [[ "${#CCWS_PREVIEW_KEYS[@]}" -gt 0 ]]
    local entry
    for entry in "${CCWS_PREVIEW_KEYS[@]}"; do
        # Must contain exactly one pipe, with non-empty env and label.
        [[ "$entry" == *"|"* ]]
        [[ -n "${entry%%|*}" ]]
        [[ -n "${entry#*|}" ]]
    done
}

# NOTE: Preview ordering and (ccws.env empty or malformed) coverage are NOT
# tested here. They live inside the single-quoted preview_cmd string in
# tui_fzf.sh, which fzf passes to a subshell. Direct bats coverage would
# require extracting the preview into a callable function (e.g.
# _ccws_tui_preview <ws_dir>) and re-wiring tui_fzf.sh to use it via fzf's
# --preview="bash -c '...'" pattern. That's a real refactor — deferred to a
# follow-up PR. Until then these paths are covered by manual QA per the plan's
# success criteria.

# --- Coverage gap fillers (ship-audit) ---

@test "_ccws_tui_cols honors exported COLUMNS when valid" {
    export COLUMNS=137
    run _ccws_tui_cols
    [[ "$output" == "137" ]]
}

@test "_ccws_tui_cols falls through to default 80 when no source reports width" {
    # Strip COLUMNS and force tput/stty to report 0/unusable by isolating PATH
    # to a directory containing only stub binaries that exit non-zero.
    local shim_dir="$BATS_TMPDIR/cols-none-$$-$RANDOM"
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
    unset COLUMNS
    PATH="$shim_dir" run _ccws_tui_cols
    [[ "$output" == "80" ]]
    rm -rf "$shim_dir"
}

@test "_ccws_fzf_min_version returns non-zero when fzf is absent" {
    # Empty PATH so `fzf --version` fails → version string empty → return 1.
    PATH="" run _ccws_fzf_min_version
    [[ "$status" -ne 0 ]]
}

@test "ccws_tui_fallback_pick renders '· active' suffix for active workspace" {
    export CCWS_NAME=work
    # Pipe 'q' to quit immediately — we only care about the rendered list (stderr).
    run bash -c "
        export HOME='$HOME'
        export CCWS_NAME=work
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui_fallback.sh'
        printf 'q\n' | ccws_tui_fallback_pick 2>&1
    "
    [[ "$output" == *"· active"* ]]
}

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

@test "ccws_tui_fzf_pick survives bin/ccws's set -u with empty start_bind array (bash 3.2 regression)" {
    # bin/ccws enables `set -euo pipefail`. Bash 3.2 treats `"${arr[@]}"` on
    # an empty array as "unbound variable" and aborts. The guard
    # `${arr[@]+"${arr[@]}"}` is the standard bash 3.2-safe pattern.
    # Regression for user-reported bug: ccws picker errored with
    # `start_bind[@]: unbound variable` when CCWS_NAME was unset (so
    # start_bind stayed empty).
    #
    # We DON'T gate on real fzf availability — the regression itself fires
    # inside ccws_tui_fzf_pick BEFORE fzf gets invoked (the unbound-var
    # error happens when bash expands the empty array on the fzf command
    # line). Stubbing fzf with a shell function and running under bash
    # explicitly reproduces the exact failure mode regardless of host fzf
    # version.
    unset CCWS_NAME
    run bash -c "
        set -euo pipefail
        export HOME='$HOME'
        # Bypass the engine's fzf-version gate so the picker code path runs
        # even on machines without fzf installed.
        _ccws_fzf_min_version() { return 0; }
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/lock.sh'
        source '$CCWS_PROJECT_ROOT/lib/symlink_farm.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui_fzf.sh'
        # Stub fzf as a function so it works whether or not real fzf is on PATH.
        fzf() { printf 'work\n'; }
        ccws_tui_fzf_pick </dev/null
    "
    # If the bug regresses, status would be 1 (set -u abort) and output
    # would contain 'unbound variable'.
    [[ "$status" -eq 0 ]]
    [[ "$output" != *"unbound variable"* ]]
}

@test "ccws_tui_fallback_pick footer includes ghost hint when CCWS_NAME points at missing workspace" {
    export CCWS_NAME=deleted-workspace
    run bash -c "
        export HOME='$HOME'
        export CCWS_NAME=deleted-workspace
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui_fallback.sh'
        printf 'q\n' | ccws_tui_fallback_pick 2>&1
    "
    [[ "$output" == *"deleted-workspace"* ]]
    [[ "$output" == *"set but workspace not found"* ]]
}

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
    # 6 logo lines surrounded by 1 blank line above and 1 below = 8 total.
    # Count non-blank lines: each logo row has box-drawing + ANSI chars so
    # is never blank; the framing newlines produce empty lines. Expect 6.
    local count
    count=$(printf '%s\n' "$output" | grep -cE '\S')
    [[ "$count" -eq 6 ]]
}

@test "_ccws_tui_logo_lines emits 6 colored lines to stdout when gates pass" {
    # The fzf picker embeds this into --header so the logo enters/exits
    # alt-screen with the picker. Verify it returns exactly 6 non-blank
    # lines with NO leading/trailing blank padding (unlike ccws_tui_logo).
    run bash -c "
        export CCWS_TUI_LOGO_FORCE=1
        export COLUMNS=80
        export LINES=40
        unset CCWS_NO_LOGO
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui.sh'
        _ccws_tui_logo_lines
    "
    [[ "$status" -eq 0 ]]
    local total non_empty
    total=$(printf '%s\n' "$output" | wc -l | tr -d ' ')
    non_empty=$(printf '%s\n' "$output" | grep -cE '\S')
    # Output should be exactly 6 non-blank lines, no padding rows.
    [[ "$total" -eq 6 ]]
    [[ "$non_empty" -eq 6 ]]
}

@test "_ccws_tui_logo_lines returns empty when CCWS_NO_LOGO=1" {
    export CCWS_NO_LOGO=1
    export CCWS_TUI_LOGO_FORCE=1
    export COLUMNS=80
    export LINES=40
    run _ccws_tui_logo_lines
    [[ "$status" -eq 0 ]]
    [[ -z "$output" ]]
}

@test "ccws_tui_run delegates to ~/.ccws/bin/ccws-picker when present" {
    mkdir -p "$HOME/.ccws/bin"
    cat > "$HOME/.ccws/bin/ccws-picker" <<'EOF'
#!/usr/bin/env bash
echo "work"
exit 0
EOF
    chmod +x "$HOME/.ccws/bin/ccws-picker"
    run ccws_tui_run
    [[ "$status" -eq 0 ]]
    [[ "$output" == "work" ]]
    rm -f "$HOME/.ccws/bin/ccws-picker"
}

@test "ccws_tui_run honors binary exit code 130 (cancel)" {
    mkdir -p "$HOME/.ccws/bin"
    cat > "$HOME/.ccws/bin/ccws-picker" <<'EOF'
#!/usr/bin/env bash
exit 130
EOF
    chmod +x "$HOME/.ccws/bin/ccws-picker"
    run ccws_tui_run
    [[ "$status" -eq 130 ]]
    [[ -z "$output" ]]
    rm -f "$HOME/.ccws/bin/ccws-picker"
}

@test "ccws_tui_run falls back to bash engine when binary absent" {
    rm -f "$HOME/.ccws/bin/ccws-picker"
    # Verify ccws_tui_run reaches the bash engine without erroring on the
    # missing binary. With CCWS_NO_TUI=1, the engine routes to fallback;
    # fallback without stdin reads EOF and returns 1 — that's expected.
    run bash -c "
        export HOME='$HOME'
        export CCWS_NO_TUI=1
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui_fallback.sh'
        ccws_tui_run </dev/null
    "
    # Exit non-zero is fine (no selection made). The point is no "command
    # not found" / "No such file" errors from missing-binary handling.
    [[ "$output" != *"command not found"* ]]
    [[ "$output" != *"No such file"* ]]
}

@test "ccws_tui_run respects CCWS_USE_BASH_TUI=1 escape hatch" {
    mkdir -p "$HOME/.ccws/bin"
    cat > "$HOME/.ccws/bin/ccws-picker" <<'EOF'
#!/usr/bin/env bash
echo "FROM_BINARY"
EOF
    chmod +x "$HOME/.ccws/bin/ccws-picker"
    # Escape hatch set → binary NOT invoked.
    run bash -c "
        export HOME='$HOME'
        export CCWS_USE_BASH_TUI=1
        export CCWS_NO_TUI=1
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui_fallback.sh'
        ccws_tui_run </dev/null
    "
    [[ "$output" != *"FROM_BINARY"* ]]
    rm -f "$HOME/.ccws/bin/ccws-picker"
}
