#!/usr/bin/env bash
# Shared helpers for ccws.
# Source-safe: defines functions, no side effects.

set -o nounset

# ----- Paths -----

ccws_root() {
    printf '%s\n' "${CCWS_ROOT:-$HOME/.ccws}"
}

ccws_workspaces_dir() {
    printf '%s\n' "$(ccws_root)/workspaces"
}

ccws_ws_dir() {
    local name="$1"
    printf '%s\n' "$(ccws_workspaces_dir)/$name"
}

ccws_lock_file() {
    printf '%s\n' "$(ccws_root)/lock"
}

ccws_conf_file() {
    printf '%s\n' "$(ccws_root)/ccws.conf"
}

# ----- Validation -----

# Accept: alphanumeric, hyphens, underscores. 1-64 chars.
# Reject: empty, contains '/', '..', whitespace, leading dot.
ccws_validate_name() {
    local name="$1"
    if [[ -z "$name" ]]; then
        ccws_log_error "workspace name cannot be empty"
        return 1
    fi
    if [[ ${#name} -gt 64 ]]; then
        ccws_log_error "workspace name too long (max 64 chars)"
        return 1
    fi
    if ! [[ "$name" =~ ^[A-Za-z0-9_-]+$ ]]; then
        ccws_log_error "workspace name must be [A-Za-z0-9_-]+"
        return 1
    fi
    # Reserved names that conflict with CLI semantics
    case "$name" in
        current|none|default-tui|--*)
            ccws_log_error "'$name' is a reserved name"
            return 1
            ;;
    esac
    return 0
}

# ----- Logging -----

ccws_log_info()  { printf 'ccws: %s\n'        "$*" >&2; }
ccws_log_warn()  { printf 'ccws: warn: %s\n'  "$*" >&2; }
ccws_log_error() { printf 'ccws: error: %s\n' "$*" >&2; }
ccws_log_ok()    { printf 'ccws: ok: %s\n'    "$*" >&2; }
