#!/usr/bin/env bash
# ccws installer — wires up PATH + shell rc only.
# Use `ccws init` after install for workspace setup.
set -euo pipefail

CCWS_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_BIN="$HOME/.local/bin"

write_shell_rc=1
while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-shell-rc) write_shell_rc=0; shift ;;
        --help|-h) cat <<'EOF'
ccws installer

Usage: ./install.sh [--no-shell-rc]

  --no-shell-rc    Don't touch ~/.bashrc / ~/.zshrc / fish config

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

# Shell rc wiring
if [[ "$write_shell_rc" -eq 1 ]]; then
    echo ""
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
        if [[ -f "$rc" ]] && ! grep -q "ccws/share/init" "$rc"; then
            {
                echo ""
                echo "# ccws — Claude Code WorkSpace"
                echo "source $CCWS_SRC/share/init.sh"
            } >> "$rc"
            echo "✓ Added init line to $rc"
        fi
    done
    fish_conf="$HOME/.config/fish/config.fish"
    if [[ -f "$fish_conf" ]] && ! grep -q "ccws/share/init" "$fish_conf"; then
        {
            echo ""
            echo "# ccws — Claude Code WorkSpace"
            echo "source $CCWS_SRC/share/init.fish"
        } >> "$fish_conf"
        echo "✓ Added init line to $fish_conf"
    fi
fi

echo ""
echo "Installed. Next:"
echo "  1. Restart your shell or 'source' your rc file"
echo "  2. Run: ccws init"
