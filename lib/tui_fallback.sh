#!/usr/bin/env bash
# Pure-bash fallback TUI — numbered menu.

ccws_tui_fallback_pick() {
    local lines=()
    while IFS= read -r line; do
        lines+=("$line")
    done < <(ccws_tui_collect_workspaces)
    if [[ "${#lines[@]}" -eq 0 ]]; then
        ccws_log_info "no workspaces — run 'ccws add <name>' first"
        return 1
    fi

    printf '\n\033[1mccws · Claude Code WorkSpace\033[0m\n\n'
    local i=1
    local names=()
    for line in "${lines[@]}"; do
        local n e _
        IFS='|' read -r n e _ <<< "$line"
        n=$(echo "$n" | xargs); e=$(echo "$e" | xargs)
        names+=("$n")
        local marker=" "
        [[ "${CCWS_NAME:-}" == "$n" ]] && marker="*"
        printf '  %s %d) %-20s (%s)\n' "$marker" "$i" "$n" "$e"
        i=$((i + 1))
    done
    printf '\nEnter number (1-%d) or q to quit: ' "$((i - 1))" >&2

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
