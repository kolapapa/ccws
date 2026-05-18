#!/usr/bin/env bash
# ccws shell init — source this from ~/.bashrc or ~/.zshrc.

# Resolve CCWS_DIR if not already set.
# zsh doesn't populate BASH_SOURCE the same way — fall back to $0,
# which in zsh is the script path when sourced. In bash, BASH_SOURCE[0]
# is the safer reference (because $0 can be the parent shell name).
if [[ -z "${CCWS_DIR:-}" ]]; then
    if [[ -n "${BASH_VERSION:-}" ]]; then
        _ccws_src="${BASH_SOURCE[0]}"
    else
        # zsh / others: $0 when sourced points at this file
        _ccws_src="$0"
    fi
    CCWS_DIR="$(cd "$(dirname "$_ccws_src")/.." && pwd)"
    export CCWS_DIR
    unset _ccws_src
fi

ccws() {
    local cmd="${1:-}"
    case "$cmd" in
        use)
            shift
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
                # Offer to launch claude immediately
                printf 'Launch claude now? [Y/n] ' >&2
                local r
                IFS= read -r r
                if [[ "$r" != "n" && "$r" != "N" ]]; then
                    claude
                fi
            fi
            ;;
        *)
            "$CCWS_DIR/bin/ccws" "$@"
            ;;
    esac
}
