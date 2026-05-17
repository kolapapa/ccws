#!/usr/bin/env bats

load ../helpers/setup
load ../helpers/fake_home

setup() {
    setup_fake_home
    ccws_source common.sh
    ccws_source symlink_farm.sh
    mkdir -p "$HOME/.ccws/workspaces/test"

    # Seed source files in ~/.claude/
    mkdir -p "$HOME/.claude/plugins" "$HOME/.claude/skills" \
             "$HOME/.claude/commands" "$HOME/.claude/hooks"
    echo '{}' > "$HOME/.claude/settings.json"
    echo '{}' > "$HOME/.claude/mcp.json"
}

teardown() {
    teardown_fake_home
}

@test "ccws_symlink_farm_create makes expected symlinks" {
    ccws_symlink_farm_create test
    local ws="$HOME/.ccws/workspaces/test"
    [[ -L "$ws/settings.json" ]]
    [[ -L "$ws/plugins" ]]
    [[ -L "$ws/skills" ]]
    [[ -L "$ws/commands" ]]
    [[ -L "$ws/hooks" ]]
    [[ -L "$ws/mcp.json" ]]
}

@test "ccws_symlink_farm_create symlinks point at ~/.claude/" {
    ccws_symlink_farm_create test
    local target
    target=$(readlink "$HOME/.ccws/workspaces/test/plugins")
    [[ "$target" == "$HOME/.claude/plugins" ]]
}

@test "ccws_symlink_farm_create skips missing source files" {
    rm -rf "$HOME/.claude/skills"
    ccws_symlink_farm_create test
    [[ ! -e "$HOME/.ccws/workspaces/test/skills" ]]
    [[ -L "$HOME/.ccws/workspaces/test/plugins" ]]
}

@test "ccws_symlink_farm_create is idempotent" {
    ccws_symlink_farm_create test
    ccws_symlink_farm_create test
    local count
    count=$(find "$HOME/.ccws/workspaces/test" -maxdepth 1 -type l | wc -l)
    # 6 symlinks (settings.json, plugins, skills, commands, hooks, mcp.json)
    [[ "$count" -eq 6 ]]
}

@test "ccws_symlink_farm_verify reports ok when all targets exist" {
    ccws_symlink_farm_create test
    run ccws_symlink_farm_verify test
    [[ "$status" -eq 0 ]]
}

@test "ccws_symlink_farm_verify reports broken when target missing" {
    ccws_symlink_farm_create test
    rm -rf "$HOME/.claude/plugins"
    run ccws_symlink_farm_verify test
    [[ "$status" -ne 0 ]]
}

@test "ccws_symlink_farm_sync removes dangling and re-adds new" {
    ccws_symlink_farm_create test
    echo "hello" > "$HOME/.claude/CLAUDE.md"
    rm "$HOME/.claude/mcp.json"
    ccws_symlink_farm_sync test
    [[ -L "$HOME/.ccws/workspaces/test/CLAUDE.md" ]]
    [[ ! -e "$HOME/.ccws/workspaces/test/mcp.json" ]]
}
