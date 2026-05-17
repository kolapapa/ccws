#!/usr/bin/env bash
# Concurrent op locking — uses flock(1) if available, bash fallback otherwise.
# macOS doesn't ship flock(1), so we fallback to lockfile via mkdir.

# shellcheck disable=SC1091
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# Usage: ccws_with_lock <timeout_sec> -- <cmd> [args...]
ccws_with_lock() {
    local timeout="$1"; shift
    [[ "$1" == "--" ]] && shift

    local lockfile
    lockfile=$(ccws_lock_file)
    mkdir -p "$(dirname "$lockfile")"

    if command -v flock >/dev/null 2>&1; then
        _ccws_lock_with_flock "$timeout" "$lockfile" "$@"
    else
        _ccws_lock_with_mkdir "$timeout" "$lockfile" "$@"
    fi
}

_ccws_lock_with_flock() {
    local timeout="$1"; local lockfile="$2"; shift 2
    (
        flock -w "$timeout" 9 || {
            ccws_log_error "could not acquire lock (held by another ccws op)"
            exit 1
        }
        "$@"
    ) 9>"$lockfile"
}

_ccws_lock_with_mkdir() {
    local timeout="$1"; local lockfile="$2"; shift 2
    local lockdir="${lockfile}.d"
    local start=$SECONDS

    while ! mkdir "$lockdir" 2>/dev/null; do
        if (( SECONDS - start >= timeout )); then
            ccws_log_error "could not acquire lock within ${timeout}s"
            return 1
        fi
        sleep 0.2
    done

    local rc=0
    "$@" || rc=$?
    rmdir "$lockdir"
    return "$rc"
}

export CCWS_LOCK_LOADED=1
