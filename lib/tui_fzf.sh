#!/usr/bin/env bash
# fzf-based TUI · Catppuccin Mocha palette · borderless centered layout.
#
# Layout: no outer frame, flush-left, terminal-native background. fzf runs
# in full-screen alt-screen mode (no --height) so the entire picker UI —
# logo + rule + help + list + preview — enters and exits the alt-screen
# buffer together. After Esc / activation, the alt-screen closes and the
# user is back at their original prompt; nothing is left in scrollback.
#
# Header layout is 8 rows: 6-row ASCII logo + 32-char dim rule + help row.
# Logo gating happens via _ccws_tui_logo_lines (CCWS_NO_LOGO=1, cols<36,
# lines<24, non-tty). When the logo is gated off, header collapses to 2 rows.
#
# List rows have no pointer marker — fzf's cursor (--pointer="❯") is the
# only ❯ on screen. Active workspace is signaled by green-bold name color
# + a dim "· active" suffix (color is the primary signal, the suffix
# preserves the cue for colorblind users). Scrollbar is forced transparent
# (--color="scrollbar:-1") so list rows don't grow a left-edge divider.
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
    # IMPORTANT: this script runs in the user's $SHELL because fzf does not
    # force bash. On default macOS the user's shell is zsh, whose arrays are
    # 1-indexed — so bash array logic here would silently miscount and report
    # valid env files as malformed. The implementation below is POSIX-shell
    # compatible: no arrays, only [ ], case/esac, grep + parameter expansion.
    # The list of preview keys is baked in as a sequence of print_kv calls at
    # assembly time, so no embedded data ever needs to flow through the
    # subshell.
    local _print_kv_calls=""
    local _pk _envname _label
    for _pk in "${CCWS_PREVIEW_KEYS[@]}"; do
        _envname="${_pk%%|*}"
        _label="${_pk#*|}"
        _print_kv_calls+="    print_kv ${_envname} ${_label}"$'\n'
    done

    # shellcheck disable=SC2016
    local preview_cmd='
        line={}
        ws_name=$(printf "%s" "$line" | sed "s/\x1b\[[0-9;]*m//g" | awk "{print \$1}")
        envfile="'"$(ccws_workspaces_dir)"'/$ws_name/ccws.env"

        if [ ! -f "$envfile" ]; then
            printf "\n  \033[38;2;243;139;168m(no ccws.env)\033[0m\n"
            exit 0
        fi

        printed=0
        printed_labels=""
        printf "\n"

        # POSIX-shell helper. Looks up $1 in the env file, masks if it ends in
        # _TOKEN/_AUTH, prints "label  value". Updates parent $printed counter.
        # Label dedup: if a label was already printed (e.g. HTTPS_PROXY and
        # HTTP_PROXY both map to "proxy"), skip subsequent matches. Avoids
        # duplicate rows when ccws_add writes both upper- and lower-case proxy
        # vars to the same env file.
        # NOTE: We deliberately do NOT skip empty values. ccws_use exports
        # empty NO_PROXY= as a real override, so the preview must reflect
        # that the key was set (even if to empty).
        print_kv() {
            envname=$1
            label=$2
            case " $printed_labels " in
                *" $label "*) return 0 ;;
            esac
            raw=$(grep "^${envname}=" "$envfile" 2>/dev/null | head -1)
            [ -z "$raw" ] && return 0
            value=${raw#*=}
            case "$envname" in
                *_TOKEN|*_AUTH|*_AUTH_TOKEN)
                    [ -n "$value" ] && value="***"
                    ;;
            esac
            printf "  \033[38;2;245;194;231m%-14s\033[0m \033[38;2;205;214;244m%s\033[0m\n" "$label" "$value"
            printed=$((printed + 1))
            printed_labels="$printed_labels $label"
        }

'"$_print_kv_calls"'
        if [ "$printed" -eq 0 ]; then
            printf "  \033[38;2;243;139;168m(ccws.env empty or malformed)\033[0m\n"
        fi

        # Final line: dim active indicator, only when this row IS the active workspace.
        if [ -n "${CCWS_NAME:-}" ] && [ "${CCWS_NAME:-}" = "$ws_name" ]; then
            printf "\n  \033[38;2;166;227;161m● active in this shell\033[0m\n"
        fi
    '

    # Header layout:
    #   logo (6 colored rows, optional — suppressed when _ccws_tui_logo_lines
    #         gates trigger: CCWS_NO_LOGO=1 / cols<36 / lines<24 / non-tty)
    #   32-char dim rule
    #   help + ghost hint (dim)
    #
    # Logo is embedded INTO --header (not printf'd before fzf) so it enters
    # and exits alt-screen along with the picker — no scrollback residue
    # after Esc, which is what every user expects.
    #
    # Footer-style help has to live in --header because fzf 0.44 has no native
    # footer slot below the preview window. Putting it last in the header keeps
    # it visible while the user navigates.
    local ghost
    ghost=$(ccws_tui_ghost_hint)
    local help_line="${c_dim}↑↓ navigate    type to filter    ↵ activate    Ctrl-Y yolo    PgUp/PgDn preview    esc cancel${c_rs}${ghost}"
    local logo_block
    logo_block=$(_ccws_tui_logo_lines)
    local header_line
    if [[ -n "$logo_block" ]]; then
        header_line="${logo_block}"$'\n'"${c_dim}${CCWS_TUI_RULE}${c_rs}"$'\n'"$help_line"
    else
        header_line="${c_dim}${CCWS_TUI_RULE}${c_rs}"$'\n'"$help_line"
    fi

    # Cursor lands on active workspace if it exists in the list.
    # Note: bash 3.2 + `set -u` (which bin/ccws enables) treats an empty-array
    # expansion `"${arr[@]}"` as "unbound variable" and aborts. Use the
    # `${arr[@]+"${arr[@]}"}` guard so the flag is only injected when set.
    local active_idx
    active_idx=$(ccws_tui_active_index)
    local start_bind=()
    if [[ "$active_idx" =~ ^[0-9]+$ ]] && [[ "$active_idx" -ge 0 ]]; then
        start_bind=(--bind="start:pos($active_idx)")
    fi

    # Force POSIX sh for fzf subshells (preview command). Project supports
    # fish (share/init.fish) and zsh users have 1-indexed arrays — both would
    # break a sh-style preview script if fzf inherited the user's $SHELL.
    # Per-invocation override; the surrounding bash environment is untouched.
    #
    # Visual rationale (revised post-user-feedback 2026-05-20):
    # - Full-screen (no --height/--min-height): fzf runs in alt-screen so the
    #   logo embedded in --header enters/exits with the picker. With --height
    #   the logo would stay in main-screen scrollback after Esc, which felt
    #   like noise after running `ccws` repeatedly.
    # - No --margin: floating-card centering felt empty and disconnected
    #   from the surrounding terminal. Flush-left fills the natural width.
    # - bg:-1 and preview-bg:-1: let the terminal's own background show
    #   through. Overriding bg made the picker feel pasted on, especially
    #   on light-theme terminals.
    # - --color="scrollbar:-1": forces the scrollbar transparent. fzf draws
    #   an inactive scrollbar even when the list fits the viewport; on dark
    #   themes it reads as a stray vertical line on each list row.
    # - --gutter=' ': fzf 0.70 defaults gutter to '▌' which renders as a
    #   solid strip down the list-left edge. A space character makes the
    #   gutter column invisible while preserving the layout.
    # - --header-first: place the header (logo + rule + help) ABOVE the
    #   prompt line. Default puts header between prompt and list, which
    #   tucks the brand mark below the input — wrong feel for an opening
    #   surface.
    # - --info=inline-right: collapse the "N/M" counter into the prompt
    #   line's right edge. Default puts it on its own row above the list,
    #   which adds a visually noisy line between prompt and content.
    # - --preview-window 'down,55%': fixed proportion of available height,
    #   no auto-fit-with-cap. Earlier `~20` was wrong because wrapped long
    #   values (e.g. https://api.deepseek.com/anthropic in a narrow column)
    #   inflate the effective row count, so a 14-key workspace renders as
    #   21+ visual rows. 55% just dedicates real estate, fzf scrolls inside
    #   it if content exceeds — no truncation marker spam.
    # - --bind 'pgup/pgdn:preview-up/down,alt-k/j:preview-up/down': preview
    #   scroll. PgUp/PgDn is the universal "scroll within" key everyone knows;
    #   alt-k/j is a vim-flavored alternative for keyboard-only users. We
    #   avoid ctrl-u/ctrl-d because those clash with fzf's defaults
    #   (clear-query / half-page-down).
    local selected
    selected=$(
        printf '%s\n' "$formatted" | SHELL=/bin/sh fzf \
            --ansi \
            --no-multi \
            --reverse \
            --border=none \
            --gutter=' ' \
            --header="$header_line" \
            --header-first \
            --info=inline-right \
            --prompt="› " \
            --pointer="❯" \
            --expect=ctrl-y \
            ${start_bind[@]+"${start_bind[@]}"} \
            --bind='pgup:preview-up,pgdn:preview-down,alt-k:preview-up,alt-j:preview-down' \
            --preview="$preview_cmd" \
            --preview-window='down,55%,wrap,border-top' \
            --preview-label='' \
            --color="fg:#cdd6f4,bg:-1,hl:#f38ba8" \
            --color="fg+:#cdd6f4,bg+:-1,hl+:#f38ba8" \
            --color="info:#cba6f7,prompt:#cba6f7,pointer:#a6e3a1" \
            --color="marker:#f5e0dc,spinner:#f5e0dc,header:#cba6f7" \
            --color="scrollbar:-1" \
            --color="preview-fg:#cdd6f4,preview-bg:-1,preview-border:#6c7086"
    )

    [[ -z "$selected" ]] && return 1
    # With --expect, fzf emits the pressed key on line 1 (empty if Enter)
    # and the selected line on line 2. Parse both, then strip ANSI from
    # the selected line and pull the first whitespace-separated token
    # (the name column). If the user pressed Ctrl-Y, prefix the name
    # with "yolo:" so bin/ccws routes through the dangerous-skip-permissions
    # launch path.
    local key="" line=""
    local _idx=0 _row
    while IFS= read -r _row; do
        case "$_idx" in
            0) key="$_row" ;;
            1) line="$_row" ;;
        esac
        _idx=$((_idx + 1))
    done <<< "$selected"

    [[ -z "$line" ]] && return 1
    local name
    name=$(printf '%s' "$line" | sed 's/\x1b\[[0-9;]*m//g' | awk '{print $1}')
    if [[ "$key" == "ctrl-y" ]]; then
        printf 'yolo:%s\n' "$name"
    else
        printf '%s\n' "$name"
    fi
}

export CCWS_TUI_FZF_LOADED=1
