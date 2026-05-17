#!/usr/bin/env bash
# ccws add <name> [--base-url URL] [--token TOK] [--binary PATH] [--description DESC]

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}"        ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_ENV_LOADED:-}"           ]] && source "$_libdir/env.sh"
[[ -z "${CCWS_LOCK_LOADED:-}"          ]] && source "$_libdir/lock.sh"
[[ -z "${CCWS_SYMLINK_FARM_LOADED:-}"  ]] && source "$_libdir/symlink_farm.sh"

ccws_cmd_add() {
    local name=""
    local args=()
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --base-url|--token|--binary|--description)
                args+=("$1" "$2"); shift 2 ;;
            -*)
                ccws_log_error "unknown flag: $1"; return 2 ;;
            *)
                if [[ -n "$name" ]]; then
                    ccws_log_error "extra positional arg: $1"; return 2
                fi
                name="$1"; shift ;;
        esac
    done

    ccws_validate_name "$name" || return 2

    local ws
    ws=$(ccws_ws_dir "$name")
    if [[ -d "$ws" ]]; then
        ccws_log_error "workspace '$name' already exists at $ws"
        return 1
    fi

    # Soft warning if ~/.claude/ missing — see spec §16 #3
    if [[ ! -d "$(ccws_real_claude_dir)" ]]; then
        # SC2088: tilde is intentional in this user-facing message string
        # shellcheck disable=SC2088
        ccws_log_warn "~/.claude/ does not exist — symlinks will be empty until you run 'claude' once, then 'ccws doctor'"
    fi

    # Capture libdir for use inside the subshell
    local libdir="$_libdir"
    # Build the env_write args string: empty when no optional flags were given
    local args_quoted=""
    if [[ ${#args[@]} -gt 0 ]]; then
        args_quoted=$(printf '%q ' "${args[@]}")
    fi
    ccws_with_lock 10 -- bash -c "
        set -e
        source '$libdir/common.sh'
        source '$libdir/env.sh'
        source '$libdir/symlink_farm.sh'
        mkdir -p '$ws'
        ccws_env_write '$name' $args_quoted
        ccws_symlink_farm_create '$name'
    "

    ccws_log_ok "created workspace '$name' at $ws"
}

export CCWS_CMD_ADD_LOADED=1
