#!/usr/bin/env bash
# fzf-based TUI with Catppuccin Mocha palette + preview pane.
#
# Palette (truecolor hex):
#   base #1e1e2e · surface0 #313244 · text #cdd6f4 · overlay0 #6c7086 (dim)
#   mauve #cba6f7 · pink #f5c2e7 · sky #89dceb · green #a6e3a1 · yellow #f9e2af

ccws_tui_fzf_pick() {
    local raw
    raw=$(ccws_tui_collect_workspaces)
    [[ -z "$raw" ]] && { ccws_log_info "no workspaces — run 'ccws add <name>'"; return 1; }

    # Format each row for display with truecolor markers.
    # Active workspace (CCWS_NAME matches) gets a mauve ▸ pointer.
    # Proxy on = green ●, off = dim ○.
    local formatted
    formatted=$(
        while IFS='|' read -r name endpoint proxy _; do
            name=$(echo "$name" | xargs)
            endpoint=$(echo "$endpoint" | xargs)
            proxy=$(echo "$proxy" | xargs)
            local marker="  "
            local namec=$'\033[38;2;245;194;231m'   # pink
            if [[ "${CCWS_NAME:-}" == "$name" ]]; then
                marker=$'\033[38;2;166;227;161m▸ '   # green pointer for current shell
                namec=$'\033[38;2;166;227;161;1m'    # bold green
            fi
            local epdisplay
            if [[ "$endpoint" == "anthropic" ]]; then
                epdisplay=$'\033[38;2;137;220;235manthropic\033[0m'
            elif [[ "$endpoint" == *"deepseek"* ]]; then
                epdisplay=$'\033[38;2;249;226;175m'"$endpoint"$'\033[0m'   # yellow for gateway
            else
                epdisplay=$'\033[38;2;137;220;235m'"$endpoint"$'\033[0m'
            fi
            local proxymark
            if [[ "$proxy" == "on" ]]; then
                proxymark=$'\033[38;2;166;227;161m● proxy\033[0m'
            else
                proxymark=$'\033[38;2;108;112;134m○ direct\033[0m'
            fi
            printf '%s%s%-14s\033[0m  %-44s  %s\n' "$marker" "$namec" "$name" "$epdisplay" "$proxymark"
        done <<< "$raw"
    )

    # Preview: cleaner view of the selected workspace's ccws.env (secrets masked).
    # shellcheck disable=SC2016
    local preview_cmd='
        line={}
        # strip ANSI then take first word
        ws_name=$(printf "%s" "$line" | sed "s/\x1b\[[0-9;]*m//g" | awk "{print \$1}" | tr -d "▸")
        ws_dir="'"$HOME"'/.ccws/workspaces/$ws_name"
        printf "\033[38;2;203;166;247;1m%s\033[0m\n" "$ws_name"
        printf "\033[38;2;108;112;134m%s\033[0m\n\n" "$ws_dir"
        if [[ -f "$ws_dir/ccws.env" ]]; then
            grep -vE "^(#|$)" "$ws_dir/ccws.env" | \
                sed -E "s/(_TOKEN=).*/\1***/" | \
                awk -F= "{
                    printf \"\033[38;2;245;194;231m%-28s\033[0m \033[38;2;205;214;244m%s\033[0m\n\", \$1, substr(\$0, length(\$1)+2)
                }"
        fi
    '

    local selected
    selected=$(
        printf '%s\n' "$formatted" | fzf \
            --ansi \
            --no-multi \
            --reverse \
            --height=80% \
            --border=rounded \
            --border-label=" ccws · workspaces " \
            --header="" \
            --prompt="› " \
            --pointer="▸" \
            --preview="$preview_cmd" \
            --preview-window=right:50%:wrap:border-rounded \
            --color="fg:#cdd6f4,bg:#1e1e2e,hl:#f38ba8" \
            --color="fg+:#cdd6f4,bg+:#313244,hl+:#f38ba8" \
            --color="info:#cba6f7,prompt:#cba6f7,pointer:#a6e3a1" \
            --color="marker:#f5e0dc,spinner:#f5e0dc,header:#cba6f7" \
            --color="border:#cba6f7,label:#cba6f7" \
            --color="preview-fg:#cdd6f4,preview-bg:#181825"
    )

    [[ -z "$selected" ]] && return 1
    # Strip ANSI escapes, find the workspace name (first word after optional ▸)
    printf '%s' "$selected" | sed 's/\x1b\[[0-9;]*m//g' | awk '{ for(i=1;i<=NF;i++){ if($i!~/▸/){ print $i; exit } } }'
}

export CCWS_TUI_FZF_LOADED=1
