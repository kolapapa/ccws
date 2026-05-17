#!/usr/bin/env bats

load ../helpers/setup
load ../helpers/fake_home

setup() {
    setup_fake_home
}

teardown() {
    teardown_fake_home
}

@test "fake \$HOME is created and isolated" {
    [[ -d "$HOME" ]]
    [[ "$HOME" != "$REAL_HOME" ]]
    [[ "$HOME" == "$BATS_TMPDIR"/* ]]
}

@test "fake \$HOME has ~/.claude bootstrap" {
    [[ -d "$HOME/.claude" ]]
}
