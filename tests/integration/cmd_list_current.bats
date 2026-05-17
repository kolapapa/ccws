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
    ccws_source cmd_list.sh
    ccws_source cmd_current.sh

    ccws_cmd_add work
    ccws_cmd_add personal --base-url "https://api.anthropic.com"
}

teardown() {
    teardown_fake_home
}

@test "ccws_cmd_list shows both workspaces" {
    run ccws_cmd_list
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"work"* ]]
    [[ "$output" == *"personal"* ]]
}

@test "ccws_cmd_list --verbose shows endpoint" {
    run ccws_cmd_list --verbose
    [[ "$output" == *"https://api.anthropic.com"* ]]
}

@test "ccws_cmd_current with no active workspace says (none)" {
    unset CCWS_NAME
    run ccws_cmd_current
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"(none)"* ]]
}

@test "ccws_cmd_current reports CCWS_NAME" {
    export CCWS_NAME=work
    run ccws_cmd_current
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"work"* ]]
}

@test "ccws_cmd_current --path prints CLAUDE_CONFIG_DIR path" {
    export CCWS_NAME=work
    run ccws_cmd_current --path
    [[ "$output" == "$HOME/.ccws/workspaces/work" ]]
}
