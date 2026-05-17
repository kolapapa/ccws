#!/usr/bin/env bash
# ccws uninstaller
set -euo pipefail

force=0
[[ "${1:-}" == "--force" || "${1:-}" == "-f" ]] && force=1

if [[ "$force" -eq 0 ]]; then
    printf 'Remove ~/.ccws/, slash commands, and shell rc entries? [y/N] '
    read -r r
    [[ "$r" == "y" || "$r" == "Y" ]] || { echo "cancelled"; exit 1; }
fi

# Remove ~/.ccws/
[[ -d "$HOME/.ccws" ]] && rm -rf "$HOME/.ccws"

# Remove symlinks
[[ -L "$HOME/.local/bin/ccws" ]] && rm "$HOME/.local/bin/ccws"

# Remove slash commands
rm -f "$HOME/.claude/commands/whoami.md" "$HOME/.claude/commands/switch.md" 2>/dev/null || true

# Strip rc entries
for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.config/fish/config.fish"; do
    [[ -f "$rc" ]] || continue
    if grep -q "ccws" "$rc"; then
        cp "$rc" "$rc.ccws-uninstall.bak"
        sed -i.tmp '/# ccws -- Claude Code WorkSpace/,+1d' "$rc"
        rm -f "$rc.tmp" 2>/dev/null || true
    fi
done

echo "ccws uninstalled. Reload your shell."
