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

    ccws_cmd_add work     --base-url "https://api.anthropic.com" --token "sk-work"
    ccws_cmd_add personal --base-url "https://api.anthropic.com" --token "sk-personal"
    ccws_cmd_add deepseek --base-url "https://api.deepseek.com/anthropic" --token "sk-ds"
}

teardown() {
    teardown_fake_home
}

@test "two shells in different workspaces see different CLAUDE_CONFIG_DIR" {
    a=$(bash -c "
        export HOME='$HOME' CCWS_DIR='$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.sh'
        ccws use work
        echo \"\$CLAUDE_CONFIG_DIR\"
    ")
    b=$(bash -c "
        export HOME='$HOME' CCWS_DIR='$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.sh'
        ccws use personal
        echo \"\$CLAUDE_CONFIG_DIR\"
    ")
    [[ "$a" != "$b" ]]
    [[ "$a" == "$HOME/.ccws/workspaces/work" ]]
    [[ "$b" == "$HOME/.ccws/workspaces/personal" ]]
}

@test "two shells see different ANTHROPIC_AUTH_TOKEN" {
    a=$(bash -c "
        export HOME='$HOME' CCWS_DIR='$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.sh'
        ccws use work
        echo \"\$ANTHROPIC_AUTH_TOKEN\"
    ")
    b=$(bash -c "
        export HOME='$HOME' CCWS_DIR='$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.sh'
        ccws use personal
        echo \"\$ANTHROPIC_AUTH_TOKEN\"
    ")
    [[ "$a" == "sk-work" ]]
    [[ "$b" == "sk-personal" ]]
}

@test "third shell on third endpoint runs independently" {
    c=$(bash -c "
        export HOME='$HOME' CCWS_DIR='$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.sh'
        ccws use deepseek
        echo \"\$ANTHROPIC_BASE_URL\"
    ")
    [[ "$c" == "https://api.deepseek.com/anthropic" ]]
}

@test "concurrent ccws add operations serialize via lock" {
    rm -rf "$HOME/.ccws/workspaces/concurrent"*
    (bash -c "
        export HOME='$HOME' CCWS_DIR='$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.sh'
        ccws add concurrent-a
    ") &
    (bash -c "
        export HOME='$HOME' CCWS_DIR='$CCWS_PROJECT_ROOT'
        source '$CCWS_PROJECT_ROOT/share/init.sh'
        ccws add concurrent-b
    ") &
    wait
    [[ -d "$HOME/.ccws/workspaces/concurrent-a" ]]
    [[ -d "$HOME/.ccws/workspaces/concurrent-b" ]]
}
