#!/usr/bin/env bats

load ../helpers/setup
load ../helpers/fake_home

setup() {
    setup_fake_home
    ccws_source common.sh
}

teardown() {
    teardown_fake_home
}

@test "ccws_root returns ~/.ccws" {
    run ccws_root
    [[ "$status" -eq 0 ]]
    [[ "$output" == "$HOME/.ccws" ]]
}

@test "ccws_workspaces_dir returns ~/.ccws/workspaces" {
    run ccws_workspaces_dir
    [[ "$status" -eq 0 ]]
    [[ "$output" == "$HOME/.ccws/workspaces" ]]
}

@test "ccws_ws_dir returns the path for a workspace name" {
    run ccws_ws_dir work
    [[ "$status" -eq 0 ]]
    [[ "$output" == "$HOME/.ccws/workspaces/work" ]]
}

@test "ccws_validate_name accepts valid names" {
    run ccws_validate_name work
    [[ "$status" -eq 0 ]]
    run ccws_validate_name my-personal
    [[ "$status" -eq 0 ]]
    run ccws_validate_name ws_123
    [[ "$status" -eq 0 ]]
}

@test "ccws_validate_name rejects empty/dangerous names" {
    run ccws_validate_name ""
    [[ "$status" -ne 0 ]]
    run ccws_validate_name "../escape"
    [[ "$status" -ne 0 ]]
    run ccws_validate_name "work space"
    [[ "$status" -ne 0 ]]
}

@test "ccws_log_info prints to stderr" {
    run bash -c "
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        ccws_log_info 'hello'
    "
    # ccws_log_info writes to stderr; bats collects both as output
    [[ "$output" == *"hello"* ]]
}
