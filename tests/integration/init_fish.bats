#!/usr/bin/env bats

load ../helpers/setup
load ../helpers/fake_home

setup() {
    if ! command -v fish >/dev/null 2>&1; then
        skip "fish shell not installed"
    fi
    setup_fake_home
    source "$CCWS_PROJECT_ROOT/lib/common.sh"
    source "$CCWS_PROJECT_ROOT/lib/env.sh"
    source "$CCWS_PROJECT_ROOT/lib/lock.sh"
    source "$CCWS_PROJECT_ROOT/lib/symlink_farm.sh"
    source "$CCWS_PROJECT_ROOT/lib/cmd_add.sh"
    ccws_cmd_add work --base-url "https://api.anthropic.com"
}

teardown() {
    if command -v fish >/dev/null 2>&1; then
        teardown_fake_home
    fi
}

@test "fish ccws use exports CLAUDE_CONFIG_DIR" {
    result=$(fish -c "
        set -gx HOME '$HOME'
        set -gx CCWS_DIR '$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.fish'
        ccws use work
        echo \$CLAUDE_CONFIG_DIR
    ")
    [[ "$result" == "$HOME/.ccws/workspaces/work" ]]
}

@test "fish ccws unset clears env vars" {
    result=$(fish -c "
        set -gx HOME '$HOME'
        set -gx CCWS_DIR '$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.fish'
        ccws use work
        ccws unset
        echo \"\$CCWS_NAME|\$CLAUDE_CONFIG_DIR\"
    ")
    [[ "$result" == "|" ]]
}

@test "fish ccws list works" {
    result=$(fish -c "
        set -gx HOME '$HOME'
        set -gx CCWS_DIR '$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.fish'
        ccws list
    ")
    [[ "$result" == *"work"* ]]
}
