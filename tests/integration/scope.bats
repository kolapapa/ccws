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
    ccws_source scope.sh
    ccws_source cmd_local.sh
    ccws_source cmd_global.sh
    ccws_source cmd_which.sh

    ccws_cmd_add work --base-url "https://api.anthropic.com" --token "sk-w" --non-interactive
    ccws_cmd_add ds   --base-url "https://api.deepseek.com/anthropic" --token "sk-d" --non-interactive
}

teardown() {
    teardown_fake_home
    unset CCWS_NAME
}

# === ccws_scope_resolve priority ===

@test "scope_resolve returns shell when CCWS_NAME is set" {
    export CCWS_NAME=work
    run ccws_scope_resolve
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"work"*"shell"* ]]
    unset CCWS_NAME
}

@test "scope_resolve falls back to local file when no shell env" {
    unset CCWS_NAME
    cd "$HOME"
    printf 'ds\n' > "$HOME/.ccws-workspace"
    run ccws_scope_resolve
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"ds"*"local:"*".ccws-workspace"* ]]
}

@test "scope_resolve walks up parent dirs for .ccws-workspace" {
    unset CCWS_NAME
    mkdir -p "$HOME/projects/sub/deep"
    printf 'work\n' > "$HOME/projects/.ccws-workspace"
    cd "$HOME/projects/sub/deep"
    run ccws_scope_resolve
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"work"*"local:"*"projects/.ccws-workspace"* ]]
}

@test "scope_resolve falls back to global when no local" {
    unset CCWS_NAME
    cd "$HOME"
    printf 'ds\n' > "$(ccws_scope_global_file)"
    run ccws_scope_resolve
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"ds"*"global"* ]]
}

@test "scope_resolve returns 1 when nothing is set" {
    unset CCWS_NAME
    cd "$HOME"
    run ccws_scope_resolve
    [[ "$status" -ne 0 ]]
}

@test "scope_resolve: shell beats local beats global" {
    cd "$HOME"
    printf 'work\n' > "$HOME/.ccws-workspace"
    printf 'ds\n'   > "$(ccws_scope_global_file)"
    # Shell wins
    export CCWS_NAME=ds
    run ccws_scope_resolve
    [[ "$output" == *"ds"*"shell"* ]]
    # Without shell, local wins
    unset CCWS_NAME
    run ccws_scope_resolve
    [[ "$output" == *"work"*"local"* ]]
    # Without local, global wins
    rm "$HOME/.ccws-workspace"
    run ccws_scope_resolve
    [[ "$output" == *"ds"*"global"* ]]
}

# === ccws_cmd_local ===

@test "cmd_local writes .ccws-workspace to PWD" {
    cd "$HOME"
    run ccws_cmd_local work
    [[ "$status" -eq 0 ]]
    [[ -f "$HOME/.ccws-workspace" ]]
    [[ "$(cat "$HOME/.ccws-workspace")" == "work" ]]
}

@test "cmd_local rejects unknown workspace" {
    cd "$HOME"
    run ccws_cmd_local nonexistent
    [[ "$status" -ne 0 ]]
    [[ ! -f "$HOME/.ccws-workspace" ]]
}

@test "cmd_local --unset removes .ccws-workspace" {
    cd "$HOME"
    printf 'work\n' > "$HOME/.ccws-workspace"
    run ccws_cmd_local --unset
    [[ "$status" -eq 0 ]]
    [[ ! -f "$HOME/.ccws-workspace" ]]
}

@test "cmd_local with no args prints current local" {
    cd "$HOME"
    printf 'ds\n' > "$HOME/.ccws-workspace"
    run ccws_cmd_local
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"ds"* ]]
}

# === ccws_cmd_global ===

@test "cmd_global writes ~/.ccws/global" {
    run ccws_cmd_global work
    [[ "$status" -eq 0 ]]
    local gf
    gf=$(ccws_scope_global_file)
    [[ -f "$gf" ]]
    [[ "$(cat "$gf")" == "work" ]]
}

@test "cmd_global --unset removes ~/.ccws/global" {
    printf 'work\n' > "$(ccws_scope_global_file)"
    run ccws_cmd_global --unset
    [[ "$status" -eq 0 ]]
    [[ ! -f "$(ccws_scope_global_file)" ]]
}

@test "cmd_global rejects unknown workspace" {
    run ccws_cmd_global nonexistent
    [[ "$status" -ne 0 ]]
}

# === ccws_cmd_which ===

@test "cmd_which prints resolved name to stdout" {
    export CCWS_NAME=work
    run ccws_cmd_which
    [[ "$status" -eq 0 ]]
    [[ "$output" == "work" ]]
    unset CCWS_NAME
}

@test "cmd_which returns 1 when nothing resolves" {
    unset CCWS_NAME
    cd "$HOME"
    run ccws_cmd_which
    [[ "$status" -ne 0 ]]
}

@test "cmd_which --explain still puts name on stdout" {
    cd "$HOME"
    printf 'work\n' > "$HOME/.ccws-workspace"
    run ccws_cmd_which --explain
    [[ "$status" -eq 0 ]]
    echo "$output" | grep -q "^work$"
}
