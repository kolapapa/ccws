#!/usr/bin/env bash
# ccws _toggle-danger <picker-row>
# Internal: flip the CCWS_DANGEROUS flag on the named workspace's ccws.env.
# Bound to `y` in the fzf picker via execute-silent. Input is fzf's `{}`
# placeholder which substitutes the full current row (including ANSI
# escapes); the first whitespace-separated token after ANSI strip is the
# workspace name.

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_ENV_LOADED:-}"    ]] && source "$_libdir/env.sh"

ccws_cmd_toggle_danger() {
    local raw="${1:-}"
    [[ -z "$raw" ]] && return 1

    # fzf's {} keeps ANSI escapes from --ansi mode. Strip them and pull
    # the first token (the name column).
    local name
    name=$(printf '%s' "$raw" | sed 's/\x1b\[[0-9;]*m//g' | awk '{print $1}')
    [[ -z "$name" ]] && return 1
    ccws_validate_name "$name" || return 2

    local envfile
    envfile=$(ccws_env_file "$name")
    [[ -f "$envfile" ]] || return 1

    local new="1"
    ccws_env_is_dangerous "$name" && new="0"
    ccws_env_set "$name" CCWS_DANGEROUS "$new"
}

export CCWS_CMD_TOGGLE_DANGER_LOADED=1
