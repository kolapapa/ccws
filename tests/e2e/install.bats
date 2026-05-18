#!/usr/bin/env bats

load ../helpers/setup
load ../helpers/fake_home

setup() {
    setup_fake_home
}

teardown() {
    teardown_fake_home
}

@test "install.sh symlinks ccws to ~/.local/bin when present" {
    mkdir -p "$HOME/.local/bin"
    bash "$CCWS_PROJECT_ROOT/install.sh" --no-shell-rc
    [[ -L "$HOME/.local/bin/ccws" ]]
}

@test "install.sh skips ~/.local/bin if not present (no error)" {
    rm -rf "$HOME/.local/bin"
    run bash "$CCWS_PROJECT_ROOT/install.sh" --no-shell-rc
    # Should succeed without error
    [[ "$status" -eq 0 ]]
}

@test "install.sh DOES NOT create ~/.ccws/" {
    bash "$CCWS_PROJECT_ROOT/install.sh" --no-shell-rc
    [[ ! -d "$HOME/.ccws" ]]
}

@test "install.sh DOES NOT install slash commands" {
    mkdir -p "$HOME/.claude/commands"
    bash "$CCWS_PROJECT_ROOT/install.sh" --no-shell-rc
    [[ ! -f "$HOME/.claude/commands/whoami.md" ]]
}

@test "install.sh reports missing fzf/gum" {
    run bash "$CCWS_PROJECT_ROOT/install.sh" --no-shell-rc
    if ! command -v gum >/dev/null; then
        [[ "$output" == *"gum"* ]]
    fi
}

@test "uninstall.sh removes ~/.ccws/ if present" {
    mkdir -p "$HOME/.ccws/workspaces"
    bash "$CCWS_PROJECT_ROOT/uninstall.sh" --force
    [[ ! -d "$HOME/.ccws" ]]
}
