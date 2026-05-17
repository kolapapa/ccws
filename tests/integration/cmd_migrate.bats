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
    ccws_source cmd_migrate.sh
}

teardown() {
    teardown_fake_home
}

@test "ccws_cmd_migrate from ~/.claude-profiles.conf imports listed profiles" {
    cat > "$HOME/.claude-profiles.conf" <<'EOF'
# format: name|config_dir|use_proxy|enable_teams
company|/Users/kola/.claude-company|1|1
gradient|/Users/kola/.claude-gradient|0|1
EOF
    mkdir -p "$HOME/.claude-company" "$HOME/.claude-gradient"

    # In test env, the config_dir paths reference /Users/kola/... but we set HOME to fake.
    # The migrate script reads the config_dir as-is; we need to test with paths that
    # resolve under fake HOME. Override the conf:
    cat > "$HOME/.claude-profiles.conf" <<EOF
company|$HOME/.claude-company|1|1
gradient|$HOME/.claude-gradient|0|1
EOF

    run ccws_cmd_migrate
    [[ "$status" -eq 0 ]]
    [[ -d "$HOME/.ccws/workspaces/company" ]]
    [[ -d "$HOME/.ccws/workspaces/gradient" ]]
}

@test "ccws_cmd_migrate creates empty workspace for missing source dir" {
    cat > "$HOME/.claude-profiles.conf" <<EOF
default|$HOME/.claude-default|0|0
EOF
    # NOT creating ~/.claude-default
    run ccws_cmd_migrate
    [[ "$status" -eq 0 ]]
    [[ -d "$HOME/.ccws/workspaces/default" ]]
    [[ "$output" == *"empty workspace"* || "$output" == *"no existing dir"* ]]
}

@test "ccws_cmd_migrate skips already-existing workspaces" {
    cat > "$HOME/.claude-profiles.conf" <<EOF
work|$HOME/.claude-work|0|0
EOF
    mkdir -p "$HOME/.claude-work"
    ccws_cmd_add work
    run ccws_cmd_migrate
    [[ "$output" == *"already exists"* || "$output" == *"skip"* ]]
}

@test "ccws_cmd_migrate --from <path> reads custom file" {
    cat > "$HOME/custom.conf" <<EOF
demo|$HOME/.claude-demo|0|0
EOF
    mkdir -p "$HOME/.claude-demo"
    run ccws_cmd_migrate --from "$HOME/custom.conf"
    [[ "$status" -eq 0 ]]
    [[ -d "$HOME/.ccws/workspaces/demo" ]]
}

@test "ccws_cmd_migrate prints summary table" {
    cat > "$HOME/.claude-profiles.conf" <<EOF
work|$HOME/.claude-work|0|0
EOF
    mkdir -p "$HOME/.claude-work"
    run ccws_cmd_migrate
    [[ "$output" == *"work"* ]]
    [[ "$output" == *"summary"* || "$output" == *"imported"* ]]
}
