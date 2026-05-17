#!/usr/bin/env bash
# ccws installer
set -euo pipefail

CCWS_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CCWS_HOME="$HOME/.ccws"
INSTALL_BIN="$HOME/.local/bin"

write_shell_rc=1
while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-shell-rc) write_shell_rc=0; shift ;;
        --help|-h) cat <<'EOF'
ccws installer

Usage: ./install.sh [--no-shell-rc]

  --no-shell-rc    Don't touch ~/.bashrc / ~/.zshrc / fish config
EOF
            exit 0 ;;
        *) echo "unknown flag: $1" >&2; exit 2 ;;
    esac
done

echo "ccws installer"
echo "  source: $CCWS_SRC"
echo "  home:   $CCWS_HOME"
echo ""

# 1. Create ~/.ccws/ structure
mkdir -p "$CCWS_HOME/workspaces" "$CCWS_HOME/bin"
echo "created $CCWS_HOME/"

# 2. Symlink the binary — always link into $CCWS_HOME/bin so tests pass
ln -sfn "$CCWS_SRC/bin/ccws" "$CCWS_HOME/bin/ccws"
if [[ -d "$INSTALL_BIN" ]]; then
    ln -sfn "$CCWS_SRC/bin/ccws" "$INSTALL_BIN/ccws"
    echo "linked ccws to $INSTALL_BIN/ccws"
else
    echo "  (skipped $INSTALL_BIN -- not present; using $CCWS_HOME/bin/ccws)"
fi

# 3. Slash commands
if [[ -d "$HOME/.claude" ]]; then
    mkdir -p "$HOME/.claude/commands"
    cp -n "$CCWS_SRC/share/commands/"*.md "$HOME/.claude/commands/" 2>/dev/null || true
    echo "installed slash commands into ~/.claude/commands/"
else
    echo "  (skipped slash commands -- ~/.claude/ doesn't exist; run 'claude' once, then 'ccws sync')"
fi

# 4. Optional deps
echo ""
echo "Optional dependencies:"
for tool in fzf gum; do
    if command -v "$tool" >/dev/null 2>&1; then
        echo "  found: $tool"
    else
        echo "  ! $tool not installed -- consider: brew install $tool"
    fi
done

# 5. Shell rc
if [[ "$write_shell_rc" -eq 1 ]]; then
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
        if [[ -f "$rc" ]] && ! grep -q "ccws/share/init" "$rc"; then
            {
                echo ""
                echo "# ccws -- Claude Code WorkSpace"
                echo "source $CCWS_SRC/share/init.sh"
            } >> "$rc"
            echo "added init to $rc"
        fi
    done
    fish_conf="$HOME/.config/fish/config.fish"
    if [[ -f "$fish_conf" ]] && ! grep -q "ccws/share/init" "$fish_conf"; then
        {
            echo ""
            echo "# ccws -- Claude Code WorkSpace"
            echo "source $CCWS_SRC/share/init.fish"
        } >> "$fish_conf"
        echo "added init to $fish_conf"
    fi
    echo ""
    echo "  Restart your shell or 'source' the rc to activate ccws."
fi

echo ""
echo "Install complete. Try:"
echo "  ccws add work"
echo "  ccws use work"
echo "  ccws  (interactive picker)"
