#!/usr/bin/env bats

load ../helpers/setup
load ../helpers/fake_home

setup() {
    setup_fake_home
    # Set up the real ccws on PATH so the wrapper can call it
    export CCWS_DIR
    CCWS_DIR="$(cd "$BATS_TEST_DIRNAME/../.." && pwd)"

    # Create a fake 'claude' binary that prints what env it sees
    mkdir -p "$HOME/bin"
    cat > "$HOME/bin/claude" <<'EOF'
#!/bin/sh
echo "CLAUDE_RAN_AS=$CCWS_NAME"
echo "CLAUDE_CONFIG_DIR=$CLAUDE_CONFIG_DIR"
EOF
    chmod +x "$HOME/bin/claude"
    export PATH="$HOME/bin:$CCWS_DIR/bin:$PATH"

    # Source helpers to make ccws_source work
    ccws_source common.sh
    ccws_source env.sh
    ccws_source lock.sh
    ccws_source symlink_farm.sh
    ccws_source cmd_add.sh

    ccws_cmd_add work --base-url "https://api.anthropic.com" --token "sk-w" --non-interactive
    ccws_cmd_add ds   --base-url "https://api.deepseek.com/anthropic" --token "sk-d" --non-interactive
}

teardown() {
    teardown_fake_home
    unset CCWS_NAME
    unset CLAUDE_CONFIG_DIR
}

@test "claude wrapper passes through when CCWS_NAME is set" {
    # shellcheck disable=SC1091
    source "$CCWS_DIR/share/claude-wrapper.sh"

    export CCWS_NAME=already-active
    run claude
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"CLAUDE_RAN_AS=already-active"* ]]
    unset CCWS_NAME
}

@test "claude wrapper auto-activates from .ccws-workspace" {
    # shellcheck disable=SC1091
    source "$CCWS_DIR/share/claude-wrapper.sh"

    unset CCWS_NAME
    cd "$HOME"
    printf 'work\n' > "$HOME/.ccws-workspace"

    run claude
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"CLAUDE_RAN_AS=work"* ]]
    [[ "$output" == *"CLAUDE_CONFIG_DIR="*"/.ccws/workspaces/work"* ]]
}

@test "claude wrapper auto-activates from global file" {
    # shellcheck disable=SC1091
    source "$CCWS_DIR/share/claude-wrapper.sh"
    # shellcheck disable=SC1091
    source "$CCWS_DIR/lib/scope.sh"

    unset CCWS_NAME
    cd "$HOME"
    printf 'ds\n' > "$(ccws_scope_global_file)"

    run claude
    [[ "$status" -eq 0 ]]
    [[ "$output" == *"CLAUDE_RAN_AS=ds"* ]]
}

@test "claude wrapper does NOT mutate parent shell env" {
    # shellcheck disable=SC1091
    source "$CCWS_DIR/share/claude-wrapper.sh"

    unset CCWS_NAME
    unset CLAUDE_CONFIG_DIR
    cd "$HOME"
    printf 'work\n' > "$HOME/.ccws-workspace"

    # Run wrapper
    claude > /dev/null 2>&1 || true

    # Parent shell should still have CCWS_NAME unset and CLAUDE_CONFIG_DIR unset
    [[ -z "${CCWS_NAME:-}" ]]
    [[ -z "${CLAUDE_CONFIG_DIR:-}" ]]
}

@test "claude wrapper falls through to plain claude when no scope" {
    # shellcheck disable=SC1091
    source "$CCWS_DIR/share/claude-wrapper.sh"

    unset CCWS_NAME
    cd "$HOME"
    # No .ccws-workspace, no global file
    run claude
    [[ "$status" -eq 0 ]]
    # CLAUDE_RAN_AS is empty (no workspace activated)
    [[ "$output" == *"CLAUDE_RAN_AS="* ]]
    [[ "$output" != *"CLAUDE_RAN_AS=work"* ]]
    [[ "$output" != *"CLAUDE_RAN_AS=ds"* ]]
}
