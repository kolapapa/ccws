#!/usr/bin/env bats

load ../helpers/setup
load ../helpers/fake_home

setup() {
    setup_fake_home
    source "$CCWS_PROJECT_ROOT/lib/common.sh"
    source "$CCWS_PROJECT_ROOT/lib/env.sh"
    source "$CCWS_PROJECT_ROOT/lib/lock.sh"
    source "$CCWS_PROJECT_ROOT/lib/symlink_farm.sh"
    source "$CCWS_PROJECT_ROOT/lib/cmd_add.sh"
    ccws_cmd_add work --base-url "https://api.anthropic.com" --token "sk-test"
}

teardown() {
    teardown_fake_home
}

@test "share/init.sh defines ccws() function" {
    bash -c "
        export CCWS_DIR='$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.sh'
        type ccws
    " | grep -q "ccws is a function"
}

@test "ccws use exports CLAUDE_CONFIG_DIR in current shell" {
    result=$(bash -c "
        export HOME='$HOME'
        export CCWS_DIR='$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.sh'
        ccws use work
        echo \"\$CLAUDE_CONFIG_DIR\"
    ")
    [[ "$result" == "$HOME/.ccws/workspaces/work" ]]
}

@test "ccws use exports ANTHROPIC_BASE_URL when configured" {
    result=$(bash -c "
        export HOME='$HOME'
        export CCWS_DIR='$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.sh'
        ccws use work
        echo \"\$ANTHROPIC_BASE_URL\"
    ")
    [[ "$result" == "https://api.anthropic.com" ]]
}

@test "ccws unset clears env vars" {
    result=$(bash -c "
        export HOME='$HOME'
        export CCWS_DIR='$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.sh'
        ccws use work
        ccws unset
        echo \"\${CLAUDE_CONFIG_DIR:-empty}|\${CCWS_NAME:-empty}\"
    ")
    [[ "$result" == "empty|empty" ]]
}

@test "ccws list is callable through wrapper" {
    result=$(bash -c "
        export HOME='$HOME'
        export CCWS_DIR='$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.sh'
        ccws list
    ")
    [[ "$result" == *"work"* ]]
}
