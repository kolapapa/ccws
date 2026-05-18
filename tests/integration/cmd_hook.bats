#!/usr/bin/env bats

load ../helpers/setup
load ../helpers/fake_home

setup() {
    setup_fake_home
    ccws_source common.sh
    ccws_source cmd_hook.sh
    export CCWS_DIR
    CCWS_DIR="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"
}

teardown() {
    teardown_fake_home
}

@test "ccws_cmd_hook --shell zsh emits source line for init.sh" {
    run ccws_cmd_hook --shell zsh
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"source"* ]]
    [[ "$output" == *"init.sh"* ]]
}

@test "ccws_cmd_hook --shell bash emits source line for init.sh" {
    run ccws_cmd_hook --shell bash
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"init.sh"* ]]
}

@test "ccws_cmd_hook --shell fish emits source line for init.fish" {
    run ccws_cmd_hook --shell fish
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"init.fish"* ]]
}

@test "ccws_cmd_hook --claude emits source line for claude-wrapper.sh" {
    run ccws_cmd_hook --claude
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"claude-wrapper.sh"* ]]
}

@test "ccws_cmd_hook --shell zsh --claude emits both lines" {
    run ccws_cmd_hook --shell zsh --claude
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"init.sh"* ]]
    [[ "$output" == *"claude-wrapper.sh"* ]]
}

@test "ccws_cmd_hook with no flags prints usage and fails" {
    run ccws_cmd_hook
    [[ "$status" -ne 0 ]]
}

@test "ccws_cmd_hook --shell rejects unknown shell" {
    run ccws_cmd_hook --shell pwsh
    [[ "$status" -ne 0 ]]
}

@test "ccws_cmd_hook --help shows usage and exits 0" {
    run ccws_cmd_hook --help
    [[ "$status" -eq 0 ]]
}
