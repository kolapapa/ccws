#!/usr/bin/env bash
# ccws rm <name> [--force]

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_LOCK_LOADED:-}"   ]] && source "$_libdir/lock.sh"

ccws_cmd_rm() {
    local name=""
    local force=0
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --force|-f) force=1; shift ;;
            -*) ccws_log_error "unknown flag: $1"; return 2 ;;
            *) name="$1"; shift ;;
        esac
    done

    ccws_validate_name "$name" || return 2

    local ws
    ws=$(ccws_ws_dir "$name")
    if [[ ! -d "$ws" ]]; then
        ccws_log_error "workspace not found: $name"
        return 1
    fi

    if [[ "${CCWS_NAME:-}" == "$name" ]]; then
        ccws_log_error "'$name' is currently active in this shell; run 'ccws unset' first"
        return 1
    fi

    if [[ "$force" -eq 0 ]]; then
        printf 'remove workspace "%s" at %s? [y/N] ' "$name" "$ws" >&2
        local reply
        IFS= read -r reply
        if [[ "$reply" != "y" && "$reply" != "Y" ]]; then
            ccws_log_info "cancelled"
            return 1
        fi
    fi

    ccws_with_lock 10 -- rm -rf "$ws"
    ccws_log_ok "removed workspace '$name'"
}

export CCWS_CMD_RM_LOADED=1
