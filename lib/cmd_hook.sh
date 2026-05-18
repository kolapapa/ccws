#!/usr/bin/env bash
# ccws hook — emit shell init code to be eval'd in your rc.
#
# Examples (add to ~/.zshrc or ~/.bashrc):
#   eval "$(ccws hook --shell zsh)"      # ccws() function for use/unset/tui
#   eval "$(ccws hook --claude)"          # opt-in claude() wrapper

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$_libdir/common.sh"

ccws_cmd_hook() {
    local shell="" want_claude=0 show_help=0
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --shell)         shell="$2"; shift 2 ;;
            --claude)        want_claude=1; shift ;;
            -h|--help)       show_help=1; shift ;;
            *) ccws_log_error "unknown flag: $1"; return 2 ;;
        esac
    done

    if [[ "$show_help" -eq 1 || ( -z "$shell" && "$want_claude" -eq 0 ) ]]; then
        cat <<'EOF' >&2
Usage: ccws hook [--shell zsh|bash|fish] [--claude]

Emit shell code to eval from your rc file.

  --shell SHELL   Initialize the ccws shell function (use/unset/TUI).
                  Add to ~/.zshrc / ~/.bashrc:
                      eval "$(ccws hook --shell zsh)"
                  For fish, add to ~/.config/fish/config.fish:
                      ccws hook --shell fish | source

  --claude        Enable opt-in claude() wrapper: when you run 'claude',
                  ccws auto-resolves .ccws-workspace / global file and
                  spawns claude with that workspace's env.
                  Add to ~/.zshrc / ~/.bashrc:
                      eval "$(ccws hook --claude)"

These can be combined:
    eval "$(ccws hook --shell zsh --claude)"
EOF
        [[ "$show_help" -eq 1 ]] && return 0
        return 2
    fi

    if [[ -z "${CCWS_DIR:-}" ]]; then
        ccws_log_error "CCWS_DIR not set — run ccws from its installed location"
        return 1
    fi

    if [[ -n "$shell" ]]; then
        case "$shell" in
            zsh|bash)
                if [[ ! -f "$CCWS_DIR/share/init.sh" ]]; then
                    ccws_log_error "share/init.sh not found at $CCWS_DIR"
                    return 1
                fi
                printf 'source %q\n' "$CCWS_DIR/share/init.sh"
                ;;
            fish)
                if [[ ! -f "$CCWS_DIR/share/init.fish" ]]; then
                    ccws_log_error "share/init.fish not found at $CCWS_DIR"
                    return 1
                fi
                # fish uses different quoting; use plain path (no spaces expected in CCWS_DIR)
                printf 'source %s\n' "$CCWS_DIR/share/init.fish"
                ;;
            *)
                ccws_log_error "unsupported shell: $shell (zsh|bash|fish)"
                return 2
                ;;
        esac
    fi

    if [[ "$want_claude" -eq 1 ]]; then
        if [[ ! -f "$CCWS_DIR/share/claude-wrapper.sh" ]]; then
            ccws_log_error "share/claude-wrapper.sh not found at $CCWS_DIR"
            return 1
        fi
        printf 'source %q\n' "$CCWS_DIR/share/claude-wrapper.sh"
    fi
}

export CCWS_CMD_HOOK_LOADED=1
