#!/usr/bin/env bats

load ../helpers/setup
load ../helpers/fake_home

setup() {
    setup_fake_home
    ccws_source common.sh
    ccws_source env.sh
    mkdir -p "$HOME/.ccws/workspaces/test"
}

teardown() {
    teardown_fake_home
}

@test "ccws_env_write creates a chmod 600 ccws.env file" {
    ccws_env_write test
    local envfile="$HOME/.ccws/workspaces/test/ccws.env"
    [[ -f "$envfile" ]]
    local mode
    mode=$(stat -f '%Lp' "$envfile" 2>/dev/null || stat -c '%a' "$envfile")
    [[ "$mode" == "600" ]]
}

@test "ccws_env_write defaults include CCWS_NAME and timestamp" {
    ccws_env_write test
    local content
    content=$(cat "$HOME/.ccws/workspaces/test/ccws.env")
    [[ "$content" == *"CCWS_NAME=test"* ]]
    [[ "$content" == *"CCWS_CREATED="* ]]
}

@test "ccws_env_write with --base-url adds endpoint" {
    ccws_env_write test --base-url "https://api.deepseek.com/anthropic" --token "sk-xxx"
    local content
    content=$(cat "$HOME/.ccws/workspaces/test/ccws.env")
    [[ "$content" == *"ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic"* ]]
    [[ "$content" == *"ANTHROPIC_AUTH_TOKEN=sk-xxx"* ]]
}

@test "ccws_env_read sources values into current shell" {
    cat > "$HOME/.ccws/workspaces/test/ccws.env" <<'EOF'
CCWS_NAME=test
ANTHROPIC_BASE_URL=https://example.com
EOF
    ccws_env_read test
    [[ "${CCWS_NAME:-}" == "test" ]]
    [[ "${ANTHROPIC_BASE_URL:-}" == "https://example.com" ]]
}

@test "ccws_env_read fails for nonexistent workspace" {
    run ccws_env_read nonexistent
    [[ "$status" -ne 0 ]]
}

@test "ccws_env_read ignores comments and blank lines" {
    cat > "$HOME/.ccws/workspaces/test/ccws.env" <<'EOF'
# A comment
CCWS_NAME=test

# Another comment
ANTHROPIC_AUTH_TOKEN=sk-abc
EOF
    ccws_env_read test
    [[ "${CCWS_NAME:-}" == "test" ]]
    [[ "${ANTHROPIC_AUTH_TOKEN:-}" == "sk-abc" ]]
}

@test "ccws_env_get reads a single value without exporting" {
    cat > "$HOME/.ccws/workspaces/test/ccws.env" <<'EOF'
CCWS_NAME=test
ANTHROPIC_BASE_URL=https://example.com
EOF
    run ccws_env_get test ANTHROPIC_BASE_URL
    [[ "$status" -eq 0 ]]
    [[ "$output" == "https://example.com" ]]
}
