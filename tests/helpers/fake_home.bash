#!/usr/bin/env bash
# Provide an isolated fake $HOME for each test

setup_fake_home() {
    export REAL_HOME="$HOME"
    export HOME="$BATS_TMPDIR/ccws-test-home-$$-$RANDOM"
    mkdir -p "$HOME/.claude"
    # Seed minimal Claude Code structure
    mkdir -p "$HOME/.claude/plugins" "$HOME/.claude/skills" "$HOME/.claude/commands" "$HOME/.claude/hooks"
    echo '{}' > "$HOME/.claude/settings.json"
}

teardown_fake_home() {
    [[ -n "${BATS_TMPDIR:-}" && -n "${HOME:-}" && "$HOME" == "$BATS_TMPDIR"/* ]] && rm -rf "$HOME"
    export HOME="$REAL_HOME"
    unset REAL_HOME
}
