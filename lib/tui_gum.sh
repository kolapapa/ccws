#!/usr/bin/env bash
# Optional gum-based polish.

# Ceremonial surface — used only by `ccws init` first-run welcome.
# Intentional border contrast vs the picker's no-frame style.
# See DESIGN.md "Surface registry" before changing this banner.
ccws_tui_banner() {
    if command -v gum >/dev/null 2>&1; then
        gum style \
            --border double \
            --margin "0 0" \
            --padding "0 1" \
            --border-foreground 99 \
            "ccws · Claude Code WorkSpace"
    else
        printf '\n\033[1mccws · Claude Code WorkSpace\033[0m\n\n'
    fi
}

ccws_tui_confirm() {
    local prompt="$1"
    if command -v gum >/dev/null 2>&1; then
        gum confirm "$prompt"
    else
        printf '%s [y/N] ' "$prompt" >&2
        local r
        IFS= read -r r
        [[ "$r" == "y" || "$r" == "Y" ]]
    fi
}

export CCWS_TUI_GUM_LOADED=1
