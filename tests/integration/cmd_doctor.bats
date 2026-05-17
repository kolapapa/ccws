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
    ccws_source cmd_doctor.sh

    ccws_cmd_add work
}

teardown() {
    teardown_fake_home
}

@test "ccws_cmd_doctor reports ok for working checks" {
    run ccws_cmd_doctor
    # Some checks WILL fail in test env (claude on PATH, shell rc) — that's fine
    [[ "$output" == *"✓"* ]] || [[ "$output" == *" ok"* ]]
}

@test "ccws_cmd_doctor warns when ~/.claude/ missing" {
    rm -rf "$HOME/.claude"
    run ccws_cmd_doctor
    [[ "$output" == *"~/.claude"* ]] && { [[ "$output" == *"missing"* ]] || [[ "$output" == *"not found"* ]]; }
}

@test "ccws_cmd_doctor warns about broken symlinks" {
    rm -rf "$HOME/.claude/plugins"
    run ccws_cmd_doctor
    [[ "$output" == *"broken"* ]] || [[ "$output" == *"plugins"* ]]
}

@test "ccws_cmd_doctor warns about external CLAUDE_CONFIG_DIR" {
    export CLAUDE_CONFIG_DIR="/some/external/path"
    unset CCWS_NAME
    run ccws_cmd_doctor
    [[ "$output" == *"CLAUDE_CONFIG_DIR"* ]]
}

@test "ccws_cmd_doctor exits 0 with warnings" {
    run ccws_cmd_doctor
    [[ "$status" -eq 0 ]]
}
