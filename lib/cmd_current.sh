#!/usr/bin/env bash
# ccws current [--path]

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$_libdir/common.sh"

ccws_cmd_current() {
    local path_only=0
    [[ "${1:-}" == "--path" || "${1:-}" == "-p" ]] && path_only=1

    if [[ -z "${CCWS_NAME:-}" ]]; then
        [[ "$path_only" -eq 1 ]] && return 1
        printf '(none) — run "ccws use <name>" to activate\n'
        return 0
    fi

    if [[ "$path_only" -eq 1 ]]; then
        printf '%s\n' "$(ccws_ws_dir "$CCWS_NAME")"
    else
        printf '%s (CLAUDE_CONFIG_DIR=%s)\n' "$CCWS_NAME" "${CLAUDE_CONFIG_DIR:-}"
    fi
}

export CCWS_CMD_CURRENT_LOADED=1
