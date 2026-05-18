#!/usr/bin/env bash
# Pure-bash fallback TUI — numbered menu, Catppuccin Mocha colors.
#
# Used when fzf is not installed or CCWS_NO_TUI=1.

ccws_tui_fallback_pick() {
    local lines=()
    while IFS= read -r line; do
        lines+=("$line")
    done < <(ccws_tui_collect_workspaces)
    if [[ "${#lines[@]}" -eq 0 ]]; then
        ccws_log_info "no workspaces — run 'ccws add <name>' first"
        return 1
    fi

    # Catppuccin Mocha truecolor escapes
    local mauve_b=$'\033[38;2;203;166;247;1m'
    local pink=$'\033[38;2;245;194;231m'
    local sky=$'\033[38;2;137;220;235m'
    local green=$'\033[38;2;166;227;161m'
    local yellow=$'\033[38;2;249;226;175m'
    local dim=$'\033[38;2;108;112;134m'
    local rs=$'\033[0m'

    printf '\n  %sccws%s %s·%s %sworkspaces%s\n' "$mauve_b" "$rs" "$dim" "$rs" "$pink" "$rs" >&2
    printf '  %s─────────────────────────────────────────────────────────%s\n' "$dim" "$rs" >&2

    local i=1
    local names=()
    for line in "${lines[@]}"; do
        local n e p _
        IFS='|' read -r n e p _ <<< "$line"
        n=$(echo "$n" | xargs)
        e=$(echo "$e" | xargs)
        p=$(echo "$p" | xargs)
        names+=("$n")

        # Marker + name color (compute visible padding separately so ANSI escapes
        # don't break printf width).
        local marker name_color
        if [[ "${CCWS_NAME:-}" == "$n" ]]; then
            marker="${green}▸${rs}"
            name_color="$green"
        else
            marker="${dim}▹${rs}"
            name_color="$pink"
        fi
        local name_pad=""
        if [[ ${#n} -lt 14 ]]; then
            printf -v name_pad '%*s' $((14 - ${#n})) ""
        fi

        # Endpoint color + width
        local ep_color e_short="$e"
        if [[ "$e" == "anthropic" ]]; then
            ep_color="$sky"
        elif [[ "$e" == *"deepseek"* ]]; then
            ep_color="$yellow"
        else
            ep_color="$sky"
        fi
        # Truncate long endpoint URLs to fit
        if [[ ${#e_short} -gt 40 ]]; then
            e_short="${e_short:0:37}..."
        fi
        local ep_pad=""
        if [[ ${#e_short} -lt 40 ]]; then
            printf -v ep_pad '%*s' $((40 - ${#e_short})) ""
        fi

        # Proxy mark
        local proxy_disp
        if [[ "$p" == "on" ]]; then
            proxy_disp="${green}● proxy${rs}"
        else
            proxy_disp="${dim}○ direct${rs}"
        fi

        printf '  %s %s%d)%s %s%s%s%s  %s%s%s%s  %s\n' \
            "$marker" "$dim" "$i" "$rs" \
            "$name_color" "$n" "$rs" "$name_pad" \
            "$ep_color" "$e_short" "$rs" "$ep_pad" \
            "$proxy_disp" >&2
        i=$((i + 1))
    done
    printf '  %s─────────────────────────────────────────────────────────%s\n' "$dim" "$rs" >&2
    printf '  %s%s↑↓%s number · %sq%s quit%s : ' "$dim" "$sky" "$rs$dim" "$sky" "$rs$dim" "$rs" >&2

    local choice
    IFS= read -r choice
    case "$choice" in
        q|Q|"") return 1 ;;
        *[!0-9]*) ccws_log_error "invalid input"; return 1 ;;
        *)
            local idx=$((choice - 1))
            if [[ "$idx" -lt 0 || "$idx" -ge "${#names[@]}" ]]; then
                ccws_log_error "out of range"
                return 1
            fi
            printf '%s\n' "${names[idx]}"
            ;;
    esac
}

export CCWS_TUI_FALLBACK_LOADED=1
