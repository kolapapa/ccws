#!/usr/bin/env bash
# ccws use <name>
# Prints shell export commands to stdout. Caller (share/init.sh) evals.

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_ENV_LOADED:-}"    ]] && source "$_libdir/env.sh"

ccws_cmd_use_print_exports() {
    local name="$1"
    ccws_validate_name "$name" || return 2

    local ws
    ws=$(ccws_ws_dir "$name")
    if [[ ! -d "$ws" ]]; then
        ccws_log_error "workspace not found: $name"
        return 1
    fi

    printf 'export CCWS_NAME=%q\n' "$name"
    printf 'export CCWS_REAL_HOME=%q\n' "$HOME"
    printf 'export CLAUDE_CONFIG_DIR=%q\n' "$ws"

    local base_url token binary
    base_url=$(ccws_env_get "$name" ANTHROPIC_BASE_URL || true)
    token=$(ccws_env_get   "$name" ANTHROPIC_AUTH_TOKEN || true)
    binary=$(ccws_env_get  "$name" CCWS_BINARY || true)

    [[ -n "$base_url" ]] && printf 'export ANTHROPIC_BASE_URL=%q\n' "$base_url"
    [[ -n "$token"    ]] && printf 'export ANTHROPIC_AUTH_TOKEN=%q\n' "$token"
    [[ -n "$binary"   ]] && {
        printf 'export CCWS_BINARY=%q\n' "$binary"
        printf 'export PATH=%q\n' "$(dirname "$binary"):$PATH"
    }
}

export CCWS_CMD_USE_LOADED=1
