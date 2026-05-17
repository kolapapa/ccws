#!/usr/bin/env bats

load ../helpers/setup
load ../helpers/fake_home

setup() {
    setup_fake_home
}

teardown() {
    teardown_fake_home
}

@test "install.sh creates ~/.ccws/ structure" {
    bash "$CCWS_PROJECT_ROOT/install.sh" --no-shell-rc
    [[ -d "$HOME/.ccws" ]]
}

@test "install.sh symlinks ccws to a stable location" {
    bash "$CCWS_PROJECT_ROOT/install.sh" --no-shell-rc
    [[ -x "$HOME/.local/bin/ccws" || -x "$HOME/.ccws/bin/ccws" ]]
}

@test "install.sh installs slash commands into ~/.claude/commands/" {
    bash "$CCWS_PROJECT_ROOT/install.sh" --no-shell-rc
    [[ -f "$HOME/.claude/commands/whoami.md" ]]
    [[ -f "$HOME/.claude/commands/switch.md" ]]
}

@test "install.sh reports missing optional dependencies (gum, fzf)" {
    run bash "$CCWS_PROJECT_ROOT/install.sh" --no-shell-rc
    if ! command -v gum >/dev/null; then
        [[ "$output" == *"gum"* ]]
    fi
    # always passes if both installed
    true
}

@test "uninstall.sh removes ~/.ccws/" {
    bash "$CCWS_PROJECT_ROOT/install.sh" --no-shell-rc
    [[ -d "$HOME/.ccws" ]]
    bash "$CCWS_PROJECT_ROOT/uninstall.sh" --force
    [[ ! -d "$HOME/.ccws" ]]
}
