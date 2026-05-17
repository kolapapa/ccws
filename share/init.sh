#!/usr/bin/env bash
# ccws shell init — source this from ~/.bashrc or ~/.zshrc.

# Resolve CCWS_DIR if not already set
if [[ -z "${CCWS_DIR:-}" ]]; then
    CCWS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    export CCWS_DIR
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
