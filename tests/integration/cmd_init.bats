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

# === ~/.claude/ exists: init creates NO workspace unless user names one ===

@test "ccws_cmd_init creates no workspace when first-workspace prompt is blank" {
    # ~/.claude/ exists via setup_fake_home; user gives blank name → no workspace
    run bash -c "
        export HOME='$HOME'
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/lock.sh'
        source '$CCWS_PROJECT_ROOT/lib/symlink_farm.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_add.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_list.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_init.sh'
        printf '\n' | ccws_cmd_init
    "
    [[ "$status" -eq 0 ]]
    # ~/.ccws/workspaces/ exists but empty
    [[ -d "$HOME/.ccws/workspaces" ]]
    [[ -z "$(ls -A "$HOME/.ccws/workspaces" 2>/dev/null)" ]]
    # 'default' should NOT be auto-created (the whole point of the redesign)
    [[ ! -d "$HOME/.ccws/workspaces/default" ]]
}

@test "ccws_cmd_init creates only the user-named workspace, never 'default'" {
    run bash -c "
        export HOME='$HOME'
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/lock.sh'
        source '$CCWS_PROJECT_ROOT/lib/symlink_farm.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_add.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_list.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_init.sh'
        # name=work, blank URL, blank token
        printf 'work\n\n\n' | ccws_cmd_init
    "
    [[ -d "$HOME/.ccws/workspaces/work" ]]
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
        printf '\n' | ccws_cmd_init
    "
    [[ -d "$HOME/.claude/commands" ]]
    [[ -f "$HOME/.claude/commands/whoami.md" ]]
    [[ -f "$HOME/.claude/commands/switch.md" ]]
}

# === no-~/.claude/ user — ccws-first scenarios ===

@test "ccws_cmd_init cancels gracefully when ~/.claude/ missing and user picks N" {
    rm -rf "$HOME/.claude"
    [[ ! -d "$HOME/.claude" ]]

    run bash -c "
        export HOME='$HOME'
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/lock.sh'
        source '$CCWS_PROJECT_ROOT/lib/symlink_farm.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_add.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_list.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_init.sh'
        # Answer N to bootstrap prompt → cancel
        printf 'N\n' | ccws_cmd_init
    "
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"cancelled"* ]]
    [[ ! -d "$HOME/.claude" ]]            # did NOT auto-create
    [[ ! -d "$HOME/.ccws/workspaces" ]] || [[ -z "$(ls -A "$HOME/.ccws/workspaces" 2>/dev/null)" ]]
}

@test "ccws_cmd_init bootstraps empty ~/.claude/ when missing and user picks Y" {
    rm -rf "$HOME/.claude"
    [[ ! -d "$HOME/.claude" ]]

    run bash -c "
        export HOME='$HOME'
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/lock.sh'
        source '$CCWS_PROJECT_ROOT/lib/symlink_farm.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_add.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_list.sh'
        source '$CCWS_PROJECT_ROOT/lib/cmd_init.sh'
        # Y to create empty ~/.claude/, then blank to skip new workspace
        printf 'Y\n\n' | ccws_cmd_init
    "
    [[ "$status" -eq 0 ]]
    [[ -d "$HOME/.claude" ]]
    [[ -d "$HOME/.claude/commands" ]]
    [[ -d "$HOME/.claude/plugins" ]]
    [[ -d "$HOME/.claude/skills" ]]
    [[ -d "$HOME/.claude/hooks" ]]
    [[ -f "$HOME/.claude/settings.json" ]]
    [[ -f "$HOME/.claude/commands/whoami.md" ]]
    [[ -f "$HOME/.claude/commands/switch.md" ]]
    # NO 'default' workspace
    [[ ! -d "$HOME/.ccws/workspaces/default" ]]
}
