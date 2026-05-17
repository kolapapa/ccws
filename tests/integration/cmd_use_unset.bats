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
    ccws_source cmd_use.sh
    ccws_source cmd_unset.sh

    ccws_cmd_add work --base-url "https://api.anthropic.com" --token "sk-anth"
    ccws_cmd_add ds   --base-url "https://api.deepseek.com/anthropic" --token "sk-ds"
}

teardown() {
    teardown_fake_home
}

@test "ccws_cmd_use_print_exports emits CLAUDE_CONFIG_DIR" {
    run ccws_cmd_use_print_exports work
    [[ "$output" == *"export CLAUDE_CONFIG_DIR="* ]]
    [[ "$output" == *"$HOME"*"/.ccws/workspaces/work"* ]]
}

@test "ccws_cmd_use_print_exports emits CCWS_NAME" {
    run ccws_cmd_use_print_exports work
    [[ "$output" == *"export CCWS_NAME=work"* ]]
}

@test "ccws_cmd_use_print_exports emits endpoint when configured" {
    run ccws_cmd_use_print_exports ds
    [[ "$output" == *"export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic"* ]]
    [[ "$output" == *"export ANTHROPIC_AUTH_TOKEN=sk-ds"* ]]
}

@test "ccws_cmd_use_print_exports skips endpoint when not configured" {
    ccws_cmd_add bare
    run ccws_cmd_use_print_exports bare
    [[ "$output" != *"ANTHROPIC_BASE_URL="* ]]
}

@test "ccws_cmd_use_print_exports fails for unknown workspace" {
    run ccws_cmd_use_print_exports nonexistent
    [[ "$status" -ne 0 ]]
}

@test "ccws_cmd_unset_print_exports unsets all relevant vars" {
    run ccws_cmd_unset_print_exports
    [[ "$output" == *"unset CCWS_NAME"* ]]
    [[ "$output" == *"unset CLAUDE_CONFIG_DIR"* ]]
    [[ "$output" == *"unset ANTHROPIC_BASE_URL"* ]]
    [[ "$output" == *"unset ANTHROPIC_AUTH_TOKEN"* ]]
}
