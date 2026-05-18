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

# === proxy support (0.5.0) ===

@test "ccws_cmd_use_print_exports emits HTTPS_PROXY/HTTP_PROXY from ccws.env" {
    cat >> "$HOME/.ccws/workspaces/work/ccws.env" <<'EOF'
HTTPS_PROXY=http://127.0.0.1:7890
HTTP_PROXY=http://127.0.0.1:7890
EOF
    run ccws_cmd_use_print_exports work
    [[ "$output" == *"export HTTPS_PROXY=http://127.0.0.1:7890"* ]]
    [[ "$output" == *"export HTTP_PROXY=http://127.0.0.1:7890"* ]]
}

@test "ccws_cmd_use_print_exports emits ALL_PROXY (socks)" {
    cat >> "$HOME/.ccws/workspaces/work/ccws.env" <<'EOF'
ALL_PROXY=socks5://127.0.0.1:7890
EOF
    run ccws_cmd_use_print_exports work
    [[ "$output" == *"export ALL_PROXY=socks5://127.0.0.1:7890"* ]]
}

@test "ccws_cmd_use_print_exports emits lowercase proxy vars" {
    cat >> "$HOME/.ccws/workspaces/work/ccws.env" <<'EOF'
https_proxy=http://127.0.0.1:7890
no_proxy=localhost,127.0.0.1
EOF
    run ccws_cmd_use_print_exports work
    echo "$output" | grep -q "^export https_proxy="
    echo "$output" | grep -q "^export no_proxy="
    # printf '%q' may backslash-escape some chars (comma in older bash); the
    # eval'd value is still correct. Test via eval rather than literal match.
    local result_no_proxy
    result_no_proxy=$(eval "$output"; echo "$no_proxy")
    [[ "$result_no_proxy" == "localhost,127.0.0.1" ]]
}

@test "ccws_cmd_use_print_exports tracks proxy vars in CCWS_EXPORTED" {
    cat >> "$HOME/.ccws/workspaces/work/ccws.env" <<'EOF'
HTTPS_PROXY=http://127.0.0.1:7890
HTTP_PROXY=http://127.0.0.1:7890
EOF
    run ccws_cmd_use_print_exports work
    local exported_line
    exported_line=$(echo "$output" | grep "CCWS_EXPORTED=")
    [[ "$exported_line" == *"HTTPS_PROXY"* ]]
    [[ "$exported_line" == *"HTTP_PROXY"* ]]
}

@test "ccws_cmd_add --proxy writes HTTPS_PROXY and HTTP_PROXY to ccws.env" {
    ccws_cmd_add proxytest --base-url "https://api.anthropic.com" --token "sk-x" --proxy "http://127.0.0.1:7890" --non-interactive
    local envfile="$HOME/.ccws/workspaces/proxytest/ccws.env"
    [[ -f "$envfile" ]]
    grep -q '^HTTPS_PROXY=http://127.0.0.1:7890$' "$envfile"
    grep -q '^HTTP_PROXY=http://127.0.0.1:7890$' "$envfile"
}
