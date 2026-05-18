#!/usr/bin/env bash
# Interactive TUI dispatcher.

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_ENV_LOADED:-}"    ]] && source "$_libdir/env.sh"

# Normalize an endpoint URL to a short, fixed-shape label for the picker list.
# Examples:
#   https://api.anthropic.com           → anthropic
#   https://api.deepseek.com/anthropic  → deepseek-gw
#   https://api.openai.com              → openai-gw
#   https://aigwasia-shasp.tidu8.cn     → aigwasia-shasp.tidu8.cn (host only)
#   (empty)                             → anthropic
ccws_tui_short_endpoint() {
    local url="$1"
    case "$url" in
        ""|anthropic|*api.anthropic.com*)  printf 'anthropic\n' ;;
        *api.deepseek.com*)                printf 'deepseek-gw\n' ;;
        *api.openai.com*)                  printf 'openai-gw\n' ;;
        *)
            local host="${url#*://}"
            host="${host%%/*}"
            printf '%s\n' "$host"
            ;;
    esac
}

# Truncate $1 to fit in $2 visible columns, adding "…" if cut.
ccws_tui_truncate() {
    local s="$1" w="$2"
    if [[ ${#s} -gt $w ]]; then
        printf '%s…\n' "${s:0:$((w - 1))}"
    else
        printf '%s\n' "$s"
    fi
}

ccws_tui_engine() {
    if [[ "${CCWS_NO_TUI:-0}" == "1" ]]; then
        printf 'disabled\n'
    elif command -v fzf >/dev/null 2>&1; then
        printf 'fzf\n'
    else
        printf 'fallback\n'
    fi
}

# Outputs lines: "name | endpoint | proxy | last_modified_unix"
# proxy is "on" or "off"
ccws_tui_collect_workspaces() {
    local ws_dir
    ws_dir=$(ccws_workspaces_dir)
    [[ -d "$ws_dir" ]] || return 0
    for d in "$ws_dir"/*/; do
        [[ -d "$d" ]] || continue
        local name
        name=$(basename "$d")
        local endpoint
        endpoint=$(ccws_env_get "$name" ANTHROPIC_BASE_URL || true)
        local proxy="off"
        ccws_env_has_proxy "$name" && proxy="on"
        local mtime
        mtime=$(stat -f %m "$d" 2>/dev/null || stat -c %Y "$d")
        printf '%s | %s | %s | %s\n' "$name" "${endpoint:-anthropic}" "$proxy" "$mtime"
    done
}

# Main entry point — returns selected workspace name on stdout, empty if cancelled.
ccws_tui_run() {
    local engine
    engine=$(ccws_tui_engine)
    case "$engine" in
        fzf)      source "$_libdir/tui_fzf.sh";      ccws_tui_fzf_pick      ;;
        fallback) source "$_libdir/tui_fallback.sh"; ccws_tui_fallback_pick ;;
        disabled) return 1 ;;
    esac
}

export CCWS_TUI_LOADED=1
