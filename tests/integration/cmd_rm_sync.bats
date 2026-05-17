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
    ccws_source cmd_rm.sh
    ccws_source cmd_sync.sh

    ccws_cmd_add work
}

teardown() {
    teardown_fake_home
}

@test "ccws_cmd_rm with --force removes workspace" {
    ccws_cmd_rm work --force
    [[ ! -d "$HOME/.ccws/workspaces/work" ]]
}

@test "ccws_cmd_rm fails for unknown workspace" {
    run ccws_cmd_rm nonexistent --force
    [[ "$status" -ne 0 ]]
}

@test "ccws_cmd_rm without --force requires confirmation (cancel on empty input)" {
    # In tests, stdin is empty, so the confirm prompt sees empty → cancels
    run bash -c "echo '' | ccws_cmd_rm work"
    [[ "$status" -ne 0 ]] || [[ -d "$HOME/.ccws/workspaces/work" ]]
}

@test "ccws_cmd_sync re-creates broken symlinks" {
    rm "$HOME/.ccws/workspaces/work/plugins"
    ccws_cmd_sync work
    [[ -L "$HOME/.ccws/workspaces/work/plugins" ]]
}

@test "ccws_cmd_sync without name syncs all workspaces" {
    ccws_cmd_add personal
    rm "$HOME/.ccws/workspaces/work/skills"
    rm "$HOME/.ccws/workspaces/personal/skills"
    ccws_cmd_sync
    [[ -L "$HOME/.ccws/workspaces/work/skills" ]]
    [[ -L "$HOME/.ccws/workspaces/personal/skills" ]]
}
