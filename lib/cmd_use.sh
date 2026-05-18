#!/usr/bin/env bash
# ccws use <name>
# Prints shell export commands to stdout. Caller (share/init.sh) evals.

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_ENV_LOADED:-}"    ]] && source "$_libdir/env.sh"

# Exports for the active workspace.
#
# Always exports:
#   CCWS_NAME, CCWS_REAL_HOME, CLAUDE_CONFIG_DIR
#
# Also exports every key from ccws.env that matches:
#   ANTHROPIC_*, CLAUDE_*, CCWS_BINARY, or any other CCWS_* not in the
#   internal metadata set (CCWS_NAME / CCWS_CREATED / CCWS_DESCRIPTION).
#   Standard proxy vars: HTTPS_PROXY / HTTP_PROXY / ALL_PROXY / NO_PROXY
#   (and their lowercase forms — some tools only honor one case).
#
# This allows users to add custom env vars like ANTHROPIC_MODEL,
# CLAUDE_CODE_EFFORT_LEVEL, HTTPS_PROXY, etc. by appending KEY=VALUE lines
# to the workspace's ccws.env file.
#
# Finally exports CCWS_EXPORTED — comma-separated list of every var name
# we exported. The shell wrapper uses this to know what to unset when
# switching workspaces or running 'ccws unset'.
ccws_cmd_use_print_exports() {
    local name="$1"
    ccws_validate_name "$name" || return 2

    local ws envfile
    ws=$(ccws_ws_dir "$name")
    envfile=$(ccws_env_file "$name")
    if [[ ! -d "$ws" ]]; then
        ccws_log_error "workspace not found: $name"
        return 1
    fi

    # Track everything we export so unset can clean it up.
    local exported_keys=(CCWS_NAME CCWS_REAL_HOME CLAUDE_CONFIG_DIR)

    printf 'export CCWS_NAME=%q\n' "$name"
    printf 'export CCWS_REAL_HOME=%q\n' "$HOME"
    printf 'export CLAUDE_CONFIG_DIR=%q\n' "$ws"

    # Iterate ccws.env and export every matching key.
    if [[ -f "$envfile" ]]; then
        local key value
        while IFS='=' read -r key value; do
            [[ -z "$key" ]] && continue
            [[ "$key" == \#* ]] && continue
            # Reject keys with non-identifier characters (security: no shell injection)
            [[ "$key" == *[![:alnum:]_]* ]] && continue

            case "$key" in
                # ccws-internal metadata — not exported to child shells
                CCWS_NAME|CCWS_CREATED|CCWS_DESCRIPTION)
                    continue
                    ;;
                # CCWS_BINARY also adjusts PATH so 'claude' resolves correctly
                CCWS_BINARY)
                    printf 'export CCWS_BINARY=%q\n' "$value"
                    printf 'export PATH=%q\n' "$(dirname "$value"):$PATH"
                    exported_keys+=(CCWS_BINARY PATH)
                    ;;
                # ANTHROPIC_*, CLAUDE_*, or any other CCWS_* — export verbatim
                ANTHROPIC_*|CLAUDE_*|CCWS_*)
                    printf 'export %s=%q\n' "$key" "$value"
                    exported_keys+=("$key")
                    ;;
                # Standard HTTP/SOCKS proxy vars — both cases (Unix tools vary)
                HTTPS_PROXY|HTTP_PROXY|ALL_PROXY|NO_PROXY)
                    printf 'export %s=%q\n' "$key" "$value"
                    exported_keys+=("$key")
                    ;;
                https_proxy|http_proxy|all_proxy|no_proxy)
                    printf 'export %s=%q\n' "$key" "$value"
                    exported_keys+=("$key")
                    ;;
                # Anything else — skip silently (could be a future ccws-internal key)
                *)
                    continue
                    ;;
            esac
        done < "$envfile"
    fi

    # Emit the tracking variable last so the shell wrapper can read it.
    # Don't use %q here — keys are validated identifiers (alphanumeric + _),
    # so they need no escaping, and %q would escape the commas separators
    # which breaks fish wrapper's parsing.
    local exported_list
    exported_list=$(IFS=,; printf '%s' "${exported_keys[*]}")
    printf 'export CCWS_EXPORTED=%s\n' "$exported_list"
    return 0
}

export CCWS_CMD_USE_LOADED=1
