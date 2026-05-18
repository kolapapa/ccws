#!/usr/bin/env bash
# ccws local [<name> | --unset]
# Manage the .ccws-workspace file in $PWD.

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_SCOPE_LOADED:-}"  ]] && source "$_libdir/scope.sh"

ccws_cmd_local() {
    local marker
    marker=$(ccws_scope_local_filename)
    local target="./$marker"

    if [[ $# -eq 0 ]]; then
        if [[ -f "$target" ]]; then
            ccws_scope_read_file "$target" || {
                ccws_log_error "$target is empty"
                return 1
            }
            return 0
        fi
        ccws_log_error "no $marker in $PWD"
        return 1
    fi

    case "$1" in
        --unset|-u)
            if [[ -f "$target" ]]; then
                rm -f "$target"
                ccws_log_ok "removed $marker from $PWD"
                return 0
            fi
            ccws_log_warn "no $marker in $PWD"
            return 0
            ;;
        -*)
            ccws_log_error "unknown flag: $1"
            return 2
            ;;
    esac

    local name="$1"
    ccws_validate_name "$name" || return 2

    local ws
    ws=$(ccws_ws_dir "$name")
    if [[ ! -d "$ws" ]]; then
        ccws_log_error "workspace '$name' does not exist (use 'ccws add $name' first)"
        return 1
    fi

    printf '%s\n' "$name" > "$target"
    ccws_log_ok "set local workspace to '$name' in $PWD"
}

export CCWS_CMD_LOCAL_LOADED=1
