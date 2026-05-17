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

@test "ccws_tui_engine respects CCWS_NO_TUI=1" {
    export CCWS_NO_TUI=1
    run ccws_tui_engine
    [[ "$output" == "disabled" ]]
}
