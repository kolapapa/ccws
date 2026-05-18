#!/usr/bin/env bash
# ccws unset — print unset commands for the wrapper to eval.
#
# Reads CCWS_EXPORTED (set by 'ccws use') to know exactly which vars
# to unset. Falls back to a hardcoded list for backward compatibility
# with shells that ran an older 'ccws use'.

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$_libdir/common.sh"

ccws_cmd_unset_print_exports() {
    if [[ -n "${CCWS_EXPORTED:-}" ]]; then
        # Modern path: read tracked vars and unset each.
        local IFS=','
        local var
        for var in $CCWS_EXPORTED; do
            [[ -z "$var" ]] && continue
            [[ "$var" == *[![:alnum:]_]* ]] && continue
            printf 'unset %s\n' "$var"
        done
    else
        # Backward-compat fallback for sessions that pre-date CCWS_EXPORTED tracking.
        printf 'unset CCWS_NAME\n'
        printf 'unset CCWS_REAL_HOME\n'
        printf 'unset CLAUDE_CONFIG_DIR\n'
        printf 'unset ANTHROPIC_BASE_URL\n'
        printf 'unset ANTHROPIC_AUTH_TOKEN\n'
        printf 'unset CCWS_BINARY\n'
    fi
    printf 'unset CCWS_EXPORTED\n'
}

export CCWS_CMD_UNSET_LOADED=1
