#!/usr/bin/env bats

load ../helpers/setup
load ../helpers/fake_home

setup() {
    setup_fake_home
    # Bootstrap a workspace via the lib (so we can test the binary's commands)
    source "$CCWS_PROJECT_ROOT/lib/common.sh"
    source "$CCWS_PROJECT_ROOT/lib/env.sh"
    source "$CCWS_PROJECT_ROOT/lib/lock.sh"
    source "$CCWS_PROJECT_ROOT/lib/symlink_farm.sh"
    source "$CCWS_PROJECT_ROOT/lib/cmd_add.sh"
    ccws_cmd_add work
}

teardown() {
    teardown_fake_home
}

@test "bin/ccws list shows workspaces" {
    run "$CCWS_PROJECT_ROOT/bin/ccws" list
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"work"* ]]
}

@test "bin/ccws current shows none when not active" {
    run "$CCWS_PROJECT_ROOT/bin/ccws" current
    [[ "$output" == *"(none)"* ]]
}

@test "bin/ccws --help prints usage" {
    run "$CCWS_PROJECT_ROOT/bin/ccws" --help
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"Usage"* || "$output" == *"usage"* ]]
}

@test "bin/ccws unknown-command errors" {
    run "$CCWS_PROJECT_ROOT/bin/ccws" totally-bogus-command
    [[ "$status" -ne 0 ]]
}

@test "bin/ccws with --no-tui and no args prints help" {
    run "$CCWS_PROJECT_ROOT/bin/ccws" --no-tui
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"Usage"* || "$output" == *"usage"* ]]
}

@test "bin/ccws add via dispatcher" {
    run "$CCWS_PROJECT_ROOT/bin/ccws" add personal
    [[ "$status" -eq 0 ]]
    [[ -d "$HOME/.ccws/workspaces/personal" ]]
}
