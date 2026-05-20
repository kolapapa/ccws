#!/usr/bin/env bash
# Pure-bash fallback TUI — numbered menu, Catppuccin Mocha colors.
#
# Used when fzf is not installed, fzf < 0.44, COLUMNS < 60, or CCWS_NO_TUI=1.
# Mirrors the fzf picker's visual language: ASCII logo above (via
# ccws_tui_logo), 32-char rule, no opening/closing list rules, no in-row
# pointer marker. The numbered prefix (1), 2)...) stays since that's how the
# user inputs the selection. See DESIGN.md "Surface registry" for the
# cross-engine alignment rules.

ccws_tui_fallback_pick() {
    local lines=()
    while IFS= read -r line; do
        lines+=("$line")
    done < <(ccws_tui_collect_workspaces)
    if [[ "${#lines[@]}" -eq 0 ]]; then
        ccws_log_info "no workspaces — run 'ccws add <name>' first"
        return 1
    fi

    ccws_tui_logo

    # Catppuccin Mocha truecolor escapes
    local pink=$'\033[38;2;245;194;231m'
    local sky=$'\033[38;2;137;220;235m'
    local green=$'\033[38;2;166;227;161m'
    local green_bold=$'\033[38;2;166;227;161;1m'
    local yellow=$'\033[38;2;249;226;175m'
    local dim=$'\033[38;2;108;112;134m'
    local rs=$'\033[0m'

    # Rule, same vocabulary as the fzf picker.
    # No leading indent — flush-left, lets the terminal's own background
    # show through (revised post-user-feedback 2026-05-19).
    local indent=""
    printf '%s%s%s%s\n\n' "$indent" "$dim" "$CCWS_TUI_RULE" "$rs" >&2

    local i=1
    local names=()
    for line in "${lines[@]}"; do
        local n e p _
        IFS='|' read -r n e p _ <<< "$line"
        n=$(echo "$n" | xargs)
        e=$(echo "$e" | xargs)
        p=$(echo "$p" | xargs)
        names+=("$n")

        # Name color signals active state. No in-row marker — the numbered
        # prefix is the only column-0 glyph.
        local name_color active_suffix=""
        if [[ "${CCWS_NAME:-}" == "$n" ]]; then
            name_color="$green_bold"
            active_suffix="  ${dim}· active${rs}"
        else
            name_color="$pink"
        fi
        local name_pad=""
        if [[ ${#n} -lt 14 ]]; then
            printf -v name_pad '%*s' $((14 - ${#n})) ""
        fi

        # Endpoint: normalized short label + truncated + colored by family.
        # if/elif here mirrors tui_fzf.sh, where the same logic IS inside
        # $(...) and bash 3.2 forbids `case` there. Keeping the chains the
        # same shape on both engines makes future edits land in lock-step.
        local e_short
        e_short=$(ccws_tui_short_endpoint "$e")
        local ep_w=24
        e_short=$(ccws_tui_truncate "$e_short" "$ep_w")
        local ep_color
        if [[ "$e_short" == "anthropic" ]]; then
            ep_color="$sky"
        elif [[ "$e_short" == *-gw ]]; then
            ep_color="$yellow"
        else
            ep_color="$pink"
        fi
        local ep_pad=""
        [[ ${#e_short} -lt $ep_w ]] && printf -v ep_pad '%*s' $((ep_w - ${#e_short})) ""

        # Proxy badge (glyph + color, redundant for colorblind users).
        local proxy_disp
        if [[ "$p" == "on" ]]; then
            proxy_disp="${green}● proxy${rs}"
        else
            proxy_disp="${dim}○ direct${rs}"
        fi

        printf '%s%s%d)%s %s%s%s%s  %s%s%s%s  %s%s\n' \
            "$indent" "$dim" "$i" "$rs" \
            "$name_color" "$n" "$rs" "$name_pad" \
            "$ep_color" "$e_short" "$rs" "$ep_pad" \
            "$proxy_disp" "$active_suffix" >&2
        i=$((i + 1))
    done
    printf '\n' >&2

    # Footer: same vocabulary as fzf picker. Numbered input + q to quit
    # (fallback doesn't have fzf's typing/arrow keys). Ghost hint appended
    # via shared helper.
    local ghost
    ghost=$(ccws_tui_ghost_hint)
    printf '%s%snumber to select    q to quit%s%s : ' "$indent" "$dim" "$rs" "$ghost" >&2

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
