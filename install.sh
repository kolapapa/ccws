#!/usr/bin/env bash
# ccws installer — wires up PATH + shell rc only.
# Use `ccws init` after install for workspace setup.
set -euo pipefail

CCWS_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_BIN="$HOME/.local/bin"

write_shell_rc=1
enable_claude_wrapper=0
while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-shell-rc) write_shell_rc=0; shift ;;
        --with-claude-wrapper) enable_claude_wrapper=1; shift ;;
        --help|-h) cat <<'EOF'
ccws installer

Usage: ./install.sh [--no-shell-rc] [--with-claude-wrapper]

  --no-shell-rc          Don't touch ~/.bashrc / ~/.zshrc / fish config
  --with-claude-wrapper  Also enable the opt-in claude() wrapper that
                         auto-resolves .ccws-workspace files (pyenv-style).
                         Replaces any external 'claude' shell function.

After install, run:  ccws init
EOF
            exit 0 ;;
        *) echo "unknown flag: $1" >&2; exit 2 ;;
    esac
done

echo "ccws installer"
echo "  source: $CCWS_SRC"
echo ""

# Symlink binary so users can call `ccws` directly.
if [[ -d "$INSTALL_BIN" ]]; then
    ln -sfn "$CCWS_SRC/bin/ccws" "$INSTALL_BIN/ccws"
    echo "✓ Linked ccws to $INSTALL_BIN/ccws"
else
    echo "  (skipped — $INSTALL_BIN not present; you can call $CCWS_SRC/bin/ccws directly)"
fi

# Detect optional deps for TUI
echo ""
echo "Optional TUI deps:"
for tool in fzf gum; do
    if command -v "$tool" >/dev/null 2>&1; then
        echo "  ✓ $tool found"
    else
        echo "  ! $tool not installed — consider: brew install $tool"
    fi
done

# Shell rc wiring — write 'ccws hook' eval lines (v0.5.0+).
# Old direct 'source .../share/init.sh' lines are detected and left alone
# (we don't silently rewrite; user can swap manually).
if [[ "$write_shell_rc" -eq 1 ]]; then
    echo ""
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
        [[ -f "$rc" ]] || continue
        if grep -qE "ccws hook|ccws/share/init" "$rc"; then
            if grep -q "ccws/share/init" "$rc" && ! grep -q "ccws hook" "$rc"; then
                echo "! $rc has legacy 'source .../share/init.sh' line"
                echo "  (still works — to upgrade, replace with: eval \"\$(ccws hook --shell ${rc##*/.}|sed s/rc//) \")"
            else
                echo "  (skipped — $rc already has ccws hook)"
            fi
            continue
        fi
        local_shell="${rc##*/.}"; local_shell="${local_shell%rc}"
        {
            echo ""
            echo "# ccws — Claude Code WorkSpace"
            echo "eval \"\$(ccws hook --shell $local_shell)\""
            if [[ "$enable_claude_wrapper" -eq 1 ]]; then
                echo "eval \"\$(ccws hook --claude)\""
            else
                echo "# Uncomment to let 'claude' auto-resolve .ccws-workspace / global:"
                echo "# eval \"\$(ccws hook --claude)\""
            fi
        } >> "$rc"
        echo "✓ Added ccws hook to $rc"
    done
    fish_conf="$HOME/.config/fish/config.fish"
    if [[ -f "$fish_conf" ]]; then
        if grep -qE "ccws hook|ccws/share/init" "$fish_conf"; then
            echo "  (skipped — $fish_conf already wired)"
        else
            {
                echo ""
                echo "# ccws — Claude Code WorkSpace"
                echo "ccws hook --shell fish | source"
                if [[ "$enable_claude_wrapper" -eq 1 ]]; then
                    echo "ccws hook --claude | source"
                else
                    echo "# Uncomment to let 'claude' auto-resolve scope:"
                    echo "# ccws hook --claude | source"
                fi
            } >> "$fish_conf"
            echo "✓ Added ccws hook to $fish_conf"
        fi
    fi
fi

echo ""
echo "Installed. Next:"
echo "  1. Restart your shell or 'source' your rc file"
echo "  2. Run: ccws init"
