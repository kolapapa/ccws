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
    ccws_source cmd_init.sh
}

teardown() {
    teardown_fake_home
}

@test "ccws_cmd_init adopts ~/.claude/ as default workspace (when answered Y)" {
    run bash -c "
        export HOME='$HOME'
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/lock.sh'
        source '$CCWS_PROJECT_ROOT/lib/symlink_farm.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_add.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_list.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_init.sh'
        printf 'Y\n\n' | ccws_cmd_init
    "
    [[ "$status" -eq 0 ]]
    [[ -d "$HOME/.ccws/workspaces/default" ]]
}

@test "ccws_cmd_init creates additional workspace when name provided" {
    run bash -c "
        export HOME='$HOME'
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/lock.sh'
        source '$CCWS_PROJECT_ROOT/lib/symlink_farm.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_add.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_list.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_init.sh'
        printf 'Y\nwork\n\n\n' | ccws_cmd_init
    "
    [[ -d "$HOME/.ccws/workspaces/work" ]]
}

@test "ccws_cmd_init skips ~/.claude/ adoption when answered N" {
    run bash -c "
        export HOME='$HOME'
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/lock.sh'
        source '$CCWS_PROJECT_ROOT/lib/symlink_farm.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_add.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_list.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_init.sh'
        printf 'N\n\n' | ccws_cmd_init
    "
    [[ ! -d "$HOME/.ccws/workspaces/default" ]]
}

@test "ccws_cmd_init re-run on initialized ccws shows status (idempotent)" {
    ccws_cmd_add work >/dev/null 2>&1
    run bash -c "
        export HOME='$HOME'
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/lock.sh'
        source '$CCWS_PROJECT_ROOT/lib/symlink_farm.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_add.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_list.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_init.sh'
        ccws_cmd_init
    "
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"already initialized"* ]]
}

@test "ccws_cmd_init creates ~/.claude/commands/ if it doesn't exist (regression)" {
    # Simulate user whose Claude Code install never created ~/.claude/commands/
    rm -rf "$HOME/.claude/commands"
    [[ ! -d "$HOME/.claude/commands" ]]
    run bash -c "
        export HOME='$HOME'
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/lock.sh'
        source '$CCWS_PROJECT_ROOT/lib/symlink_farm.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_add.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_list.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_init.sh'
        printf 'N\n\n' | ccws_cmd_init
    "
    [[ -d "$HOME/.claude/commands" ]]
    [[ -f "$HOME/.claude/commands/whoami.md" ]]
    [[ -f "$HOME/.claude/commands/switch.md" ]]
}

@test "ccws_cmd_init installs slash commands" {
    rm -rf "$HOME/.claude/commands"
    mkdir -p "$HOME/.claude/commands"
    run bash -c "
        export HOME='$HOME'
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/lock.sh'
        source '$CCWS_PROJECT_ROOT/lib/symlink_farm.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_add.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_list.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_init.sh'
        printf 'Y\n\n' | ccws_cmd_init
    "
    [[ -f "$HOME/.claude/commands/whoami.md" ]]
    [[ -f "$HOME/.claude/commands/switch.md" ]]
}
