#!/usr/bin/env bats

load ../helpers/setup
load ../helpers/fake_home

setup() {
    setup_fake_home
    ccws_source common.sh
    ccws_source lock.sh
    mkdir -p "$HOME/.ccws"
}

teardown() {
    teardown_fake_home
}

@test "ccws_with_lock executes command holding lock" {
    local file="$HOME/.ccws/lock"
    ccws_with_lock 5 -- bash -c "echo locked > '$HOME/result'"
    [[ -f "$file" ]] || [[ -d "$file.d" ]] || true
    [[ "$(cat "$HOME/result")" == "locked" ]]
}

@test "ccws_with_lock returns command exit code" {
    run ccws_with_lock 5 -- bash -c "exit 42"
    [[ "$status" -eq 42 ]]
}

@test "ccws_with_lock serializes concurrent runs" {
    rm -f "$HOME/marker"
    (ccws_with_lock 10 -- bash -c "echo first > '$HOME/marker'; sleep 0.4") &
    sleep 0.1
    ccws_with_lock 10 -- bash -c "echo \"\$(cat '$HOME/marker') second\" > '$HOME/marker'"
    wait
    [[ "$(cat "$HOME/marker")" == "first second" ]]
}

@test "ccws_with_lock times out when lock unavailable" {
    (ccws_with_lock 5 -- sleep 1) &
    sleep 0.1
    run ccws_with_lock 0 -- echo "should not run"
    [[ "$status" -ne 0 ]]
    wait
}
