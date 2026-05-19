#!/usr/bin/env bash
# Provide an isolated fake $HOME for each test

setup_fake_home() {
    export REAL_HOME="$HOME"
    export HOME="$BATS_TMPDIR/ccws-test-home-$$-$RANDOM"
    mkdir -p "$HOME/.claude"
    # Seed minimal Claude Code structure
    mkdir -p "$HOME/.claude/plugins" "$HOME/.claude/skills" "$HOME/.claude/commands" "$HOME/.claude/hooks"
    echo '{}' > "$HOME/.claude/settings.json"
    # Scrub ccws/Claude env vars that may be inherited from the developer's
    # active shell. Tests assume a clean slate; without this, scope resolution
    # picks up CCWS_NAME from the host shell (e.g. "gradient") and tests that
    # expect "(none)" or a fixture name fail mysteriously on the maintainer's
    # machine while passing in CI.
    unset CCWS_NAME CLAUDE_CONFIG_DIR
    unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN ANTHROPIC_MODEL
    unset ANTHROPIC_DEFAULT_OPUS_MODEL ANTHROPIC_DEFAULT_SONNET_MODEL ANTHROPIC_DEFAULT_HAIKU_MODEL
    unset CLAUDE_CODE_EFFORT_LEVEL CLAUDE_CODE_SUBAGENT_MODEL
    unset HTTPS_PROXY HTTP_PROXY ALL_PROXY NO_PROXY https_proxy http_proxy all_proxy no_proxy
}

teardown_fake_home() {
    [[ -n "${BATS_TMPDIR:-}" && -n "${HOME:-}" && "$HOME" == "$BATS_TMPDIR"/* ]] && rm -rf "$HOME"
    export HOME="$REAL_HOME"
    unset REAL_HOME
}
