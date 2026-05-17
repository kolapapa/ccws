#!/usr/bin/env bash
# ccws unset — print unset commands for the wrapper to eval

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$_libdir/common.sh"

ccws_cmd_unset_print_exports() {
    printf 'unset CCWS_NAME\n'
    printf 'unset CCWS_REAL_HOME\n'
    printf 'unset CLAUDE_CONFIG_DIR\n'
    printf 'unset ANTHROPIC_BASE_URL\n'
    printf 'unset ANTHROPIC_AUTH_TOKEN\n'
    printf 'unset CCWS_BINARY\n'
}

export CCWS_CMD_UNSET_LOADED=1
