#!/usr/bin/env bats

load ../helpers/setup
load ../helpers/fake_home

setup() {
    setup_fake_home
    ccws_source common.sh
    ccws_source env.sh
    ccws_source lock.sh
    ccws_source symlink_farm.sh
    ccws_source cmd_add.sh
    ccws_source cmd_use.sh
    ccws_source cmd_unset.sh

    ccws_cmd_add work --base-url "https://api.anthropic.com" --token "sk-anth"
    ccws_cmd_add ds   --base-url "https://api.deepseek.com/anthropic" --token "sk-ds"
}

teardown() {
    teardown_fake_home
}

@test "ccws_cmd_use_print_exports emits CLAUDE_CONFIG_DIR" {
    run ccws_cmd_use_print_exports work
    [[ "$output" == *"export CLAUDE_CONFIG_DIR="* ]]
    [[ "$output" == *"$HOME"*"/.ccws/workspaces/work"* ]]
}

@test "ccws_cmd_use_print_exports emits CCWS_NAME" {
    run ccws_cmd_use_print_exports work
    [[ "$output" == *"export CCWS_NAME=work"* ]]
}

@test "ccws_cmd_use_print_exports emits endpoint when configured" {
    run ccws_cmd_use_print_exports ds
    [[ "$output" == *"export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic"* ]]
    [[ "$output" == *"export ANTHROPIC_AUTH_TOKEN=sk-ds"* ]]
}

@test "ccws_cmd_use_print_exports skips endpoint when not configured" {
    ccws_cmd_add bare
    run ccws_cmd_use_print_exports bare
    [[ "$output" != *"ANTHROPIC_BASE_URL="* ]]
}

@test "ccws_cmd_use_print_exports fails for unknown workspace" {
    run ccws_cmd_use_print_exports nonexistent
    [[ "$status" -ne 0 ]]
}

@test "ccws_cmd_unset_print_exports unsets all relevant vars (legacy fallback)" {
    unset CCWS_EXPORTED
    run ccws_cmd_unset_print_exports
    [[ "$output" == *"unset CCWS_NAME"* ]]
    [[ "$output" == *"unset CLAUDE_CONFIG_DIR"* ]]
    [[ "$output" == *"unset ANTHROPIC_BASE_URL"* ]]
    [[ "$output" == *"unset ANTHROPIC_AUTH_TOKEN"* ]]
    [[ "$output" == *"unset CCWS_EXPORTED"* ]]
}

# === arbitrary env var support (0.4.0) ===

@test "ccws_cmd_use_print_exports emits arbitrary ANTHROPIC_*/CLAUDE_* vars from ccws.env" {
    cat >> "$HOME/.ccws/workspaces/work/ccws.env" <<'EOF'
ANTHROPIC_MODEL=deepseek-v4-pro
ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro
CLAUDE_CODE_EFFORT_LEVEL=max
CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
EOF
    run ccws_cmd_use_print_exports work
    [[ "$output" == *"export ANTHROPIC_MODEL=deepseek-v4-pro"* ]]
    [[ "$output" == *"export ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro"* ]]
    [[ "$output" == *"export CLAUDE_CODE_EFFORT_LEVEL=max"* ]]
    [[ "$output" == *"export CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash"* ]]
}

@test "ccws_cmd_use_print_exports skips ccws-internal metadata (CCWS_CREATED, CCWS_DESCRIPTION)" {
    cat >> "$HOME/.ccws/workspaces/work/ccws.env" <<'EOF'
CCWS_DESCRIPTION=should not be exported
EOF
    run ccws_cmd_use_print_exports work
    [[ "$output" != *"export CCWS_DESCRIPTION="* ]]
    [[ "$output" != *"export CCWS_CREATED="* ]]
}

@test "ccws_cmd_use_print_exports rejects malformed keys (injection defense)" {
    cat >> "$HOME/.ccws/workspaces/work/ccws.env" <<'EOF'
EVIL;rm -rf /=should-not-execute
ANTHROPIC_OK=fine
EOF
    run ccws_cmd_use_print_exports work
    [[ "$output" != *"EVIL"* ]]
    [[ "$output" == *"export ANTHROPIC_OK=fine"* ]]
}

@test "ccws_cmd_use_print_exports emits CCWS_EXPORTED listing every exported key" {
    cat >> "$HOME/.ccws/workspaces/work/ccws.env" <<'EOF'
ANTHROPIC_MODEL=foo
CLAUDE_CODE_EFFORT_LEVEL=high
EOF
    run ccws_cmd_use_print_exports work
    local exported_line
    exported_line=$(echo "$output" | grep "CCWS_EXPORTED=")
    [[ "$exported_line" == *"CCWS_NAME"* ]]
    [[ "$exported_line" == *"CLAUDE_CONFIG_DIR"* ]]
    [[ "$exported_line" == *"ANTHROPIC_BASE_URL"* ]]
    [[ "$exported_line" == *"ANTHROPIC_MODEL"* ]]
    [[ "$exported_line" == *"CLAUDE_CODE_EFFORT_LEVEL"* ]]
}

@test "ccws_cmd_unset_print_exports cleans every var listed in CCWS_EXPORTED" {
    export CCWS_EXPORTED="CCWS_NAME,CLAUDE_CONFIG_DIR,ANTHROPIC_MODEL,CLAUDE_CODE_EFFORT_LEVEL"
    run ccws_cmd_unset_print_exports
    [[ "$output" == *"unset CCWS_NAME"* ]]
    [[ "$output" == *"unset ANTHROPIC_MODEL"* ]]
    [[ "$output" == *"unset CLAUDE_CODE_EFFORT_LEVEL"* ]]
    [[ "$output" == *"unset CCWS_EXPORTED"* ]]
    unset CCWS_EXPORTED
}
