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
}

teardown() {
    teardown_fake_home
}

@test "ccws_cmd_add creates workspace dir and env file" {
    run ccws_cmd_add work
    [[ "$status" -eq 0 ]]
    [[ -d "$HOME/.ccws/workspaces/work" ]]
    [[ -f "$HOME/.ccws/workspaces/work/ccws.env" ]]
}

@test "ccws_cmd_add creates symlink farm" {
    ccws_cmd_add work
    [[ -L "$HOME/.ccws/workspaces/work/plugins" ]]
    [[ -L "$HOME/.ccws/workspaces/work/skills" ]]
}

@test "ccws_cmd_add rejects duplicate name" {
    ccws_cmd_add work
    run ccws_cmd_add work
    [[ "$status" -ne 0 ]]
    [[ "$output" == *"already exists"* ]]
}

@test "ccws_cmd_add rejects invalid name" {
    run ccws_cmd_add "work space"
    [[ "$status" -ne 0 ]]
    run ccws_cmd_add ""
    [[ "$status" -ne 0 ]]
}

@test "ccws_cmd_add --base-url stores endpoint" {
    ccws_cmd_add ds --base-url "https://api.deepseek.com/anthropic" --token "sk-x"
    local env
    env=$(cat "$HOME/.ccws/workspaces/ds/ccws.env")
    [[ "$env" == *"ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic"* ]]
    [[ "$env" == *"ANTHROPIC_AUTH_TOKEN=sk-x"* ]]
}

@test "ccws_cmd_add warns if ~/.claude/ does not exist (no-bootstrap policy)" {
    rm -rf "$HOME/.claude"
    run ccws_cmd_add ws
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"~/.claude"* ]] || [[ "$output" == *"doctor"* ]]
}
