#!/usr/bin/env bash
# fzf-based TUI · Catppuccin Mocha palette · width-aware columns · responsive preview.
#
# Layout (wide window, ≥100 cols):
#   ┌──── ccws · workspaces ────┐
#   │ ▸ company  anthropic    │  preview pane (right, 55%)
#   │   deepseek   deepseek-gw  │
#   └──────────────────────────┘
#
# Layout (narrow, 70–99 cols): preview moves below.
# Layout (<70 cols): preview hidden entirely.

ccws_tui_fzf_pick() {
    local raw
    raw=$(ccws_tui_collect_workspaces)
    [[ -z "$raw" ]] && { ccws_log_info "no workspaces — run 'ccws add <name>'"; return 1; }

    # Column widths (plain-text, before colorization)
    local name_w=12 ep_w=24

    # Build rendered rows. We compute padding on the PLAIN text length, then
    # wrap each cell in its ANSI colors. Otherwise printf's %-N format counts
    # the escape bytes and the column boundaries collapse.
    local formatted
    formatted=$(
        while IFS='|' read -r name endpoint proxy _; do
            name=$(printf '%s' "$name" | awk '{$1=$1};1')
            endpoint=$(printf '%s' "$endpoint" | awk '{$1=$1};1')
            proxy=$(printf '%s' "$proxy" | awk '{$1=$1};1')

            local ep_short
            ep_short=$(ccws_tui_short_endpoint "$endpoint")
            ep_short=$(ccws_tui_truncate "$ep_short" "$ep_w")

            local name_disp
            name_disp=$(ccws_tui_truncate "$name" "$name_w")

            # Compute padding on plain length
            local name_pad=""
            local ep_pad=""
            [[ ${#name_disp} -lt $name_w ]] && printf -v name_pad '%*s' $((name_w - ${#name_disp})) ""
            [[ ${#ep_short}   -lt $ep_w   ]] && printf -v ep_pad   '%*s' $((ep_w   - ${#ep_short}))   ""

            # Marker + name color
            local marker name_color
            if [[ "${CCWS_NAME:-}" == "$name" ]]; then
                marker=$'\033[38;2;166;227;161m▸\033[0m'    # green
                name_color=$'\033[38;2;166;227;161;1m'      # bold green
            else
                marker=' '
                name_color=$'\033[38;2;245;194;231m'        # pink
            fi

            # Endpoint color (yellow for gateway-style, sky for anthropic-style)
            local ep_color
            case "$ep_short" in
                anthropic)            ep_color=$'\033[38;2;137;220;235m' ;;
                deepseek-gw|openai-gw|*-gw) ep_color=$'\033[38;2;249;226;175m' ;;
                *)                    ep_color=$'\033[38;2;180;190;254m' ;;  # lavender for custom hosts
            esac
            local rs=$'\033[0m'

            # Proxy badge
            local proxy_disp
            if [[ "$proxy" == "on" ]]; then
                proxy_disp=$'\033[38;2;166;227;161m● proxy \033[0m'
            else
                proxy_disp=$'\033[38;2;108;112;134m○ direct\033[0m'
            fi

            printf ' %s %s%s%s%s  %s%s%s%s  %s\n' \
                "$marker" \
                "$name_color" "$name_disp" "$rs" "$name_pad" \
                "$ep_color" "$ep_short" "$rs" "$ep_pad" \
                "$proxy_disp"
        done <<< "$raw"
    )

    # Preview command — clean key/value table, secrets masked, no redundant path.
    # shellcheck disable=SC2016
    local preview_cmd='
        line={}
        ws_name=$(printf "%s" "$line" | sed "s/\x1b\[[0-9;]*m//g" | sed "s/[▸ ]\+//" | awk "{print \$1}")
        ws_dir="'"$HOME"'/.ccws/workspaces/$ws_name"
        envfile="$ws_dir/ccws.env"

        # Title
        printf "\n  \033[38;2;203;166;247;1m%s\033[0m\n" "$ws_name"
        printf "  \033[38;2;108;112;134m─────────────────────────\033[0m\n\n"

        if [[ ! -f "$envfile" ]]; then
            printf "  \033[38;2;243;139;168m(no ccws.env)\033[0m\n"
            exit 0
        fi

        # Print key/value lines from ccws.env, masking secrets, in a clean table.
        # Keys colored pink, values cdd6f4 (default text).
        grep -vE "^(#|$)" "$envfile" | while IFS="=" read -r k v; do
            case "$k" in
                *_TOKEN|*_AUTH|*_AUTH_TOKEN) v="***" ;;
            esac
            # Friendly label
            label="$k"
            case "$k" in
                ANTHROPIC_BASE_URL)   label="ENDPOINT" ;;
                ANTHROPIC_AUTH_TOKEN) label="TOKEN" ;;
                HTTPS_PROXY|HTTP_PROXY) label="PROXY" ;;
                ALL_PROXY)            label="SOCKS" ;;
                CCWS_NAME)            continue ;;
                CCWS_DESCRIPTION)     label="DESCRIPTION" ;;
                CCWS_CREATED)         label="CREATED" ;;
                CCWS_BINARY)          label="BINARY" ;;
                ANTHROPIC_MODEL)      label="MODEL" ;;
                ANTHROPIC_DEFAULT_OPUS_MODEL)   label="OPUS" ;;
                ANTHROPIC_DEFAULT_SONNET_MODEL) label="SONNET" ;;
                ANTHROPIC_DEFAULT_HAIKU_MODEL)  label="HAIKU" ;;
                CLAUDE_CODE_EFFORT_LEVEL)       label="EFFORT" ;;
                CLAUDE_CODE_SUBAGENT_MODEL)     label="SUBAGENT" ;;
                NO_PROXY|no_proxy)              label="NO_PROXY" ;;
                https_proxy|http_proxy)         label="PROXY" ;;
                all_proxy)                      label="SOCKS" ;;
            esac
            printf "  \033[38;2;245;194;231m%-14s\033[0m \033[38;2;205;214;244m%s\033[0m\n" "$label" "$v"
        done

        # Show resolved scope (where would claude wrapper pick this from)
        printf "\n  \033[38;2;108;112;134m─────────────────────────\033[0m\n"
        if [[ -n "${CCWS_NAME:-}" && "$CCWS_NAME" == "$ws_name" ]]; then
            printf "  \033[38;2;166;227;161m● active in this shell\033[0m\n"
        fi
    '

    local selected
    selected=$(
        printf '%s\n' "$formatted" | fzf \
            --ansi \
            --no-multi \
            --reverse \
            --height=85% \
            --border=rounded \
            --border-label=" ccws · workspaces " \
            --header="" \
            --prompt="› " \
            --pointer="▸" \
            --preview="$preview_cmd" \
            --preview-window='right,55%,wrap,border-rounded,<100(down,60%,wrap,border-rounded),<70(hidden)' \
            --color="fg:#cdd6f4,bg:#1e1e2e,hl:#f38ba8" \
            --color="fg+:#cdd6f4,bg+:#313244,hl+:#f38ba8" \
            --color="info:#cba6f7,prompt:#cba6f7,pointer:#a6e3a1" \
            --color="marker:#f5e0dc,spinner:#f5e0dc,header:#cba6f7" \
            --color="border:#cba6f7,label:#cba6f7" \
            --color="preview-fg:#cdd6f4,preview-bg:#181825,preview-border:#6c7086"
    )

    [[ -z "$selected" ]] && return 1
    # Strip ANSI then find first non-marker word
    printf '%s' "$selected" | sed 's/\x1b\[[0-9;]*m//g' | awk '
        {
            for (i=1; i<=NF; i++) {
                if ($i !~ /^[▸ ]*$/) { print $i; exit }
            }
        }'
}

export CCWS_TUI_FZF_LOADED=1
