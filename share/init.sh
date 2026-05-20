#!/usr/bin/env bash
# ccws shell init — source this from ~/.bashrc or ~/.zshrc.

# Resolve CCWS_DIR every time this file is sourced.
# (Always re-resolve so a stale value from a previous shell session is replaced.)
# zsh doesn't populate BASH_SOURCE the same way — fall back to $0,
# which in zsh is the script path when sourced. In bash, BASH_SOURCE[0]
# is the safer reference (because $0 can be the parent shell name).
if [[ -n "${BASH_VERSION:-}" ]]; then
    _ccws_src="${BASH_SOURCE[0]}"
else
    # zsh / others: $0 when sourced points at this file
    _ccws_src="$0"
fi
CCWS_DIR="$(cd "$(dirname "$_ccws_src")/.." && pwd)"
export CCWS_DIR
unset _ccws_src

ccws() {
    local cmd="${1:-}"
    case "$cmd" in
        use)
            shift
            # Clean up the previous workspace's exports first so we don't
            # leak stale ANTHROPIC_MODEL etc. when switching between workspaces
            # with different env-var sets.
            local unset_cmds
            unset_cmds=$("$CCWS_DIR/bin/ccws" unset 2>/dev/null) && eval "$unset_cmds"
            local exports
            exports=$("$CCWS_DIR/bin/ccws" use "$@") || return $?
            eval "$exports"
            ;;
        unset)
            local exports
            exports=$("$CCWS_DIR/bin/ccws" unset)
            eval "$exports"
            ;;
        "")
            # No-arg: TUI picker emits eval-able exports for the selection.
            local exports
            exports=$("$CCWS_DIR/bin/ccws") || return $?
            if [[ -n "$exports" ]]; then
                eval "$exports"
                # Yolo mode: picker captured Ctrl-Y (fzf) or y<N> input
                # (fallback). Launch claude with --dangerously-skip-permissions
                # immediately — the user already opted in, no [Y/n] prompt.
                if [[ "${CCWS_LAUNCH_MODE:-}" == "yolo" ]]; then
                    unset CCWS_LAUNCH_MODE
                    claude --dangerously-skip-permissions
                else
                    # Offer to launch claude immediately
                    printf 'Launch claude now? [Y/n] ' >&2
                    local r
                    IFS= read -r r
                    if [[ "$r" != "n" && "$r" != "N" ]]; then
                        claude
                    fi
                fi
            fi
            ;;
        *)
            "$CCWS_DIR/bin/ccws" "$@"
            ;;
    esac
}
