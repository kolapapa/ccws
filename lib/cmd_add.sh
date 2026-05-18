#!/usr/bin/env bash
# ccws add <name> [--base-url URL] [--token TOK] [--binary PATH] [--description DESC] [--proxy URL]

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}"        ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_ENV_LOADED:-}"           ]] && source "$_libdir/env.sh"
[[ -z "${CCWS_LOCK_LOADED:-}"          ]] && source "$_libdir/lock.sh"
[[ -z "${CCWS_SYMLINK_FARM_LOADED:-}"  ]] && source "$_libdir/symlink_farm.sh"

ccws_cmd_add() {
    # Parse args first; then prompt for any optional fields the user didn't
    # provide on the command line (unless --non-interactive). This gives:
    #   ccws add                              → prompts for everything
    #   ccws add work                         → prompts for url/token/desc
    #   ccws add work --base-url X            → prompts for token/desc
    #   ccws add work --base-url X --token Y  → no prompts (scripted)
    #   ccws add work --non-interactive       → no prompts (explicit)
    local name=""
    local args=()
    # Track which optional fields the user provided via flags so we know
    # which ones to prompt for. --binary is supported but not prompted
    # for (rare setting; only users who know they need it pass --binary).
    local has_base_url=0 has_token=0 has_description=0 has_proxy=0
    local non_interactive=0
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --base-url)        args+=("$1" "$2"); has_base_url=1;    shift 2 ;;
            --token)           args+=("$1" "$2"); has_token=1;       shift 2 ;;
            --binary)          args+=("$1" "$2");                    shift 2 ;;
            --description)     args+=("$1" "$2"); has_description=1; shift 2 ;;
            --proxy)           args+=("$1" "$2"); has_proxy=1;       shift 2 ;;
            --non-interactive) non_interactive=1; shift ;;
            -*)
                ccws_log_error "unknown flag: $1"; return 2 ;;
            *)
                if [[ -n "$name" ]]; then
                    ccws_log_error "extra positional arg: $1"; return 2
                fi
                name="$1"; shift ;;
        esac
    done

    # If no name given and not non-interactive, prompt for it.
    if [[ -z "$name" && "$non_interactive" -eq 0 ]]; then
        printf 'Workspace name: ' >&2
        IFS= read -r name || true
        [[ -z "$name" ]] && { ccws_log_error "name required"; return 2; }
    fi

    # Prompt for optional fields that weren't provided via flags
    # (unless --non-interactive was set).
    # `|| true` on each read: EOF returns 1, which under `set -e` (bats default)
    # would abort the function. We want EOF to just mean "blank input".
    if [[ "$non_interactive" -eq 0 ]]; then
        if [[ "$has_base_url" -eq 0 ]]; then
            printf 'Endpoint URL (Anthropic default, blank to skip): ' >&2
            local _url=""
            IFS= read -r _url || true
            [[ -n "$_url" ]] && args+=(--base-url "$_url")
        fi
        if [[ "$has_token" -eq 0 ]]; then
            printf 'API token (paste, hidden; blank to skip): ' >&2
            local _token=""
            IFS= read -rs _token || true
            echo "" >&2
            [[ -n "$_token" ]] && args+=(--token "$_token")
        fi
        if [[ "$has_description" -eq 0 ]]; then
            printf 'Description (optional): ' >&2
            local _desc=""
            IFS= read -r _desc || true
            [[ -n "$_desc" ]] && args+=(--description "$_desc")
        fi
        if [[ "$has_proxy" -eq 0 ]]; then
            printf 'Enable proxy? [y/N]: ' >&2
            local _yn=""
            IFS= read -r _yn || true
            if [[ "$_yn" == "y" || "$_yn" == "Y" ]]; then
                printf 'Proxy URL [http://127.0.0.1:7890]: ' >&2
                local _proxy=""
                IFS= read -r _proxy || true
                [[ -z "$_proxy" ]] && _proxy="http://127.0.0.1:7890"
                args+=(--proxy "$_proxy")
            fi
        fi
    fi

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
