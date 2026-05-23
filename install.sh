#!/usr/bin/env bash
# ccws installer — downloads the compiled binary from GitHub Releases.
# Use --from-source to link the bash dispatcher instead (developer mode).
set -euo pipefail

REPO="kolapapa/ccws"
INSTALL_BIN="$HOME/.local/bin"

write_shell_rc=1
enable_claude_wrapper=0
from_source=0
version=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-shell-rc)         write_shell_rc=0; shift ;;
        --with-claude-wrapper) enable_claude_wrapper=1; shift ;;
        --from-source)         from_source=1; shift ;;
        --version)             version="$2"; shift 2 ;;
        --help|-h)
            cat <<'EOF'
ccws installer

Usage: ./install.sh [--no-shell-rc] [--with-claude-wrapper] [--version vX.Y.Z]

  --no-shell-rc          Don't touch ~/.bashrc / ~/.zshrc / fish config
  --with-claude-wrapper  Also enable the opt-in claude() wrapper
  --version vX.Y.Z       Pin to a specific release (default: latest)

Developer mode: --from-source is no longer supported (v1.0 removed bash).
Build from source with:
    bun install && bun run build:host
    ln -sfn "\$(pwd)/dist/ccws-host" "\$HOME/.local/bin/ccws"

After install, run:  ccws init
EOF
            exit 0 ;;
        *) echo "unknown flag: $1" >&2; exit 2 ;;
    esac
done

detect_platform() {
    local os arch
    case "$(uname -s)" in
        Darwin) os="darwin" ;;
        Linux)  os="linux" ;;
        *) echo "unsupported OS: $(uname -s)" >&2; exit 1 ;;
    esac
    case "$(uname -m)" in
        arm64|aarch64) arch="arm64" ;;
        x86_64|amd64)  arch="x64" ;;
        *) echo "unsupported arch: $(uname -m)" >&2; exit 1 ;;
    esac
    printf '%s-%s' "$os" "$arch"
}

echo "ccws installer"

mkdir -p "$INSTALL_BIN"

if [[ "$from_source" -eq 1 ]]; then
    echo "error: --from-source is no longer supported (bash entry point removed in v1.0)" >&2
    echo "Build from source instead:" >&2
    echo "  bun install && bun run build:host" >&2
    echo "  ln -sfn \$(pwd)/dist/ccws-host \$HOME/.local/bin/ccws" >&2
    exit 2
fi

plat=$(detect_platform)
if [[ -z "$version" ]]; then
    version=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name": *"\(v[^"]*\)".*/\1/p')
    if [[ -z "$version" ]]; then
        echo "Could not detect latest release tag — pass --version vX.Y.Z" >&2
        exit 1
    fi
fi

url_ccws="https://github.com/$REPO/releases/download/$version/ccws-$plat"

echo "  Downloading $version ($plat)..."
curl -fsSL "$url_ccws" -o "$INSTALL_BIN/ccws"
chmod +x "$INSTALL_BIN/ccws"
echo "  ✓ ccws → $INSTALL_BIN/ccws"

# Clean up the legacy ccws-picker copy from pre-v1.x installs (now unused).
rm -f "$HOME/.ccws/bin/ccws-picker" 2>/dev/null || true

if [[ "$write_shell_rc" -eq 1 ]]; then
    echo ""
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
        [[ -f "$rc" ]] || continue
        if grep -qE "ccws hook|ccws/share/init" "$rc"; then
            echo "  (skipped — $rc already wired)"
            continue
        fi
        shell_name="${rc##*/.}"; shell_name="${shell_name%rc}"
        {
            echo ""
            echo "# ccws — Claude Code WorkSpace"
            echo "eval \"\$(ccws hook --shell $shell_name)\""
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
    if [[ -f "$fish_conf" ]] && ! grep -qE "ccws hook|ccws/share/init" "$fish_conf"; then
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

echo ""
echo "Installed. Next:"
echo "  1. Restart your shell or 'source' your rc file"
echo "  2. Run: ccws init"
