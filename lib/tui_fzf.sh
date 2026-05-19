#!/usr/bin/env bash
# fzf-based TUI · Catppuccin Mocha palette · borderless centered layout.
#
# Layout: no outer frame. Indent via --margin='1,8,1,8'. Title line + 32-char
# rule rendered in --header. List rows have no pointer marker — fzf's cursor
# (--pointer="❯") is the only ❯ on screen. Active workspace is signaled by
# green-bold name color + a dim "· active" suffix (color is the primary
# signal, the suffix preserves the cue for colorblind users).
#
# Preview lives BELOW the list (--preview-window='down,9,wrap,border-top')
# and renders ccws.env keys in CCWS_PREVIEW_KEYS order. Footer is a single
# dim line with help text and any ghost-active hint appended.
#
# See DESIGN.md for the full color palette, glyph inventory, layout
# principles, and surface registry.

ccws_tui_fzf_pick() {
    local raw
    raw=$(ccws_tui_collect_workspaces)
    [[ -z "$raw" ]] && { ccws_log_info "no workspaces — run 'ccws add <name>'"; return 1; }

    # Column widths (plain-text, before colorization)
    local name_w=12 ep_w=24

    # Pre-assign ANSI escapes to plain vars BEFORE any `case` statement uses
    # them — bash 3.2 (macOS /bin/bash) mis-parses semicolons inside
    # $'\033[38;2;R;G;Bm' literals when they appear directly in case arms.
    local c_pink=$'\033[38;2;245;194;231m'
    local c_green=$'\033[38;2;166;227;161m'
    local c_green_bold=$'\033[38;2;166;227;161;1m'
    local c_sky=$'\033[38;2;137;220;235m'
    local c_yellow=$'\033[38;2;249;226;175m'
    local c_lavender=$'\033[38;2;180;190;254m'
    local c_dim=$'\033[38;2;108;112;134m'
    local c_mauve_bold=$'\033[38;2;203;166;247;1m'
    local c_rs=$'\033[0m'

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

            # Name color signals active state. No in-row marker glyph — the
            # fzf cursor (❯) is the only ❯ on screen.
            local name_color active_suffix=""
            if [[ "${CCWS_NAME:-}" == "$name" ]]; then
                name_color="$c_green_bold"
                active_suffix="  ${c_dim}· active${c_rs}"
            else
                name_color="$c_pink"
            fi

            # Endpoint color. NOTE: must be if/elif (NOT case) — bash 3.2 on
            # macOS has a known parser bug where `case ... esac` inside `$(...)`
            # command substitution is rejected with "syntax error near `;;'".
            local ep_color
            if [[ "$ep_short" == "anthropic" ]]; then
                ep_color="$c_sky"
            elif [[ "$ep_short" == *-gw ]]; then
                ep_color="$c_yellow"
            else
                ep_color="$c_lavender"
            fi

            # Proxy badge. Glyph + color (redundant signaling for colorblind users).
            local proxy_disp
            if [[ "$proxy" == "on" ]]; then
                proxy_disp="${c_green}● proxy ${c_rs}"
            else
                proxy_disp="${c_dim}○ direct${c_rs}"
            fi

            # No leading marker — row starts at column 0 of the fzf window.
            # Margin is delivered by --margin, not row-content padding.
            printf '%s%s%s%s  %s%s%s%s  %s%s\n' \
                "$name_color" "$name_disp" "$c_rs" "$name_pad" \
                "$ep_color" "$ep_short" "$c_rs" "$ep_pad" \
                "$proxy_disp" "$active_suffix"
        done <<< "$raw"
    )

    # Preview command — iterates CCWS_PREVIEW_KEYS in order. Keys absent from
    # ccws.env are silently skipped. Malformed/empty env files show a single
    # dim warning line so the user knows preview wasn't broken.
    #
    # IMPORTANT (bash 3.2): the preview command is a single-quoted string passed
    # to fzf. It runs in a sub-shell launched by fzf. Existing `case "$k"`
    # inside this string works because it isn't nested inside $(...) command
    # substitution. If you ever refactor to embed $(...) here, switch the
    # `case` to `if/elif` chains (see commit 9ec8bde and lib/tui_fzf.sh near
    # the endpoint color block).
    #
    # We embed CCWS_PREVIEW_KEYS by expanding it into the single-quoted string
    # at definition time (concatenated newline-separated). The preview
    # sub-shell receives a static list of "env|label" pairs, no env var
    # passing needed.
    local _preview_keys_block=""
    local _pk
    for _pk in "${CCWS_PREVIEW_KEYS[@]}"; do
        _preview_keys_block+="$_pk"$'\n'
    done

    # shellcheck disable=SC2016
    local preview_cmd='
        line={}
        ws_name=$(printf "%s" "$line" | sed "s/\x1b\[[0-9;]*m//g" | awk "{print \$1}")
        ws_dir="'"$HOME"'/.ccws/workspaces/$ws_name"
        envfile="$ws_dir/ccws.env"

        if [[ ! -f "$envfile" ]]; then
            printf "\n  \033[38;2;243;139;168m(no ccws.env)\033[0m\n"
            exit 0
        fi

        # Parse ccws.env into parallel arrays (bash 3.2: no assoc arrays).
        keys=()
        vals=()
        while IFS="=" read -r k v; do
            [[ -z "$k" || "$k" == \#* ]] && continue
            case "$k" in
                *_TOKEN|*_AUTH|*_AUTH_TOKEN) v="***" ;;
            esac
            keys+=("$k")
            vals+=("$v")
        done < <(grep -vE "^(#|$)" "$envfile")

        # Iterate the fixed preview order. Each line is "ENV_VAR|label".
        # Look up each ENV_VAR in the parsed keys; if present, print label + value.
        printed=0
        ORDER='"'$_preview_keys_block'"'
        printf "\n"
        while IFS= read -r row; do
            [[ -z "$row" ]] && continue
            envname=${row%%|*}
            label=${row#*|}
            i=0
            while [[ $i -lt ${#keys[@]} ]]; do
                if [[ "${keys[$i]}" == "$envname" ]]; then
                    printf "  \033[38;2;245;194;231m%-14s\033[0m \033[38;2;205;214;244m%s\033[0m\n" \
                        "$label" "${vals[$i]}"
                    printed=$((printed + 1))
                    break
                fi
                i=$((i + 1))
            done
        done <<< "$ORDER"

        if [[ "$printed" -eq 0 ]]; then
            printf "  \033[38;2;243;139;168m(ccws.env empty or malformed)\033[0m\n"
        fi

        # Final line: dim active indicator, only when this row IS the active workspace.
        if [[ -n "${CCWS_NAME:-}" && "$CCWS_NAME" == "$ws_name" ]]; then
            printf "\n  \033[38;2;166;227;161m● active in this shell\033[0m\n"
        fi
    '

    # Two-line header: title (mauve bold) + 32-char rule (dim).
    local rule="────────────────────────────────"
    local header_line="${c_mauve_bold}ccws · workspaces${c_rs}"$'\n'"${c_dim}${rule}${c_rs}"

    # Footer: dim help + optional ghost-active hint.
    local ghost
    ghost=$(ccws_tui_ghost_hint)
    local footer_line="${c_dim}↑↓ navigate    type to filter    ↵ activate    esc cancel${c_rs}${ghost}"

    # Cursor lands on active workspace if it exists in the list.
    local active_idx
    active_idx=$(ccws_tui_active_index)
    local start_bind=()
    if [[ "$active_idx" =~ ^[0-9]+$ ]] && [[ "$active_idx" -ge 0 ]]; then
        start_bind=(--bind="start:pos($active_idx)")
    fi

    local selected
    selected=$(
        printf '%s\n' "$formatted" | fzf \
            --ansi \
            --no-multi \
            --reverse \
            --height='~18' \
            --min-height=18 \
            --border=none \
            --margin='1,8,1,8' \
            --header="$header_line" \
            --prompt="› " \
            --pointer="❯" \
            "${start_bind[@]}" \
            --preview="$preview_cmd" \
            --preview-window='down,9,wrap,border-top' \
            --preview-label='' \
            --color="fg:#cdd6f4,bg:#1e1e2e,hl:#f38ba8" \
            --color="fg+:#cdd6f4,bg+:#313244,hl+:#f38ba8" \
            --color="info:#cba6f7,prompt:#cba6f7,pointer:#a6e3a1" \
            --color="marker:#f5e0dc,spinner:#f5e0dc,header:#cba6f7" \
            --color="preview-fg:#cdd6f4,preview-bg:#181825,preview-border:#6c7086"
    )

    # Footer is rendered AFTER fzf exits (fzf has no native footer slot below
    # the preview). This keeps the picker height stable while still surfacing
    # the help line + ghost hint.
    printf '%b\n' "$footer_line" >&2

    [[ -z "$selected" ]] && return 1
    # Strip ANSI then take the first whitespace-separated token (the name column).
    printf '%s' "$selected" | sed 's/\x1b\[[0-9;]*m//g' | awk '{print $1}'
}

export CCWS_TUI_FZF_LOADED=1
