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
