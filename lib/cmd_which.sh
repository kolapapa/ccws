#!/usr/bin/env bash
# ccws which [--explain]
# Print the workspace name that would be active given current scope.
# Plain mode: just the name on stdout (scriptable).
# --explain:  detailed breakdown to stderr.

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_SCOPE_LOADED:-}"  ]] && source "$_libdir/scope.sh"

ccws_cmd_which() {
    local explain=0
    case "${1:-}" in
        --explain|-v) explain=1 ;;
        -*) ccws_log_error "unknown flag: $1"; return 2 ;;
    esac

    local resolved
    if resolved=$(ccws_scope_resolve); then
        local name source
        name="${resolved%%	*}"
        source="${resolved#*	}"
        printf '%s\n' "$name"
        if [[ "$explain" -eq 1 ]]; then
            printf '  source: %s\n' "$source" >&2
        fi
        return 0
    fi

    if [[ "$explain" -eq 1 ]]; then
        local localfile globalfile
        globalfile=$(ccws_scope_global_file)
        if localfile=$(ccws_scope_find_local); then
            printf '  .ccws-workspace: %s (empty)\n' "$localfile" >&2
        else
            printf '  .ccws-workspace: not found in %s or parents\n' "$PWD" >&2
        fi
        if [[ -f "$globalfile" ]]; then
            printf '  global:          %s (empty)\n' "$globalfile" >&2
        else
            printf '  global:          not set (%s)\n' "$globalfile" >&2
        fi
        printf '  CCWS_NAME:       unset\n' >&2
    fi
    return 1
}

export CCWS_CMD_WHICH_LOADED=1
