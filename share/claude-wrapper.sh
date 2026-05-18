#!/usr/bin/env bash
# ccws claude() wrapper — opt-in via 'ccws hook --claude' added to ~/.bashrc/~/.zshrc.
#
# Behavior:
#   1. If CCWS_NAME is already set (you ran 'ccws use foo'), pass through —
#      your shell env is authoritative.
#   2. Otherwise, ask 'ccws which' to resolve scope. Order: shell > local
#      (.ccws-workspace in $PWD or parents) > global (~/.ccws/global) > none.
#      If a workspace resolves, run claude in a subshell with that workspace's
#      env exported. Your parent shell's env is NOT mutated.
#   3. If nothing resolves, run plain claude (uses ~/.claude default).
#
# This mirrors pyenv's shim model: the tool sees the right config per directory
# without your shell silently changing under you.

claude() {
    if [[ -n "${CCWS_NAME:-}" ]]; then
        command claude "$@"
        return $?
    fi

    local name
    if ! name=$(command ccws which 2>/dev/null); then
        command claude "$@"
        return $?
    fi

    local exports
    if ! exports=$(command ccws use "$name" 2>/dev/null); then
        command claude "$@"
        return $?
    fi

    (
        eval "$exports"
        command claude "$@"
    )
}
