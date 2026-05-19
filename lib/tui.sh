#!/usr/bin/env bash
# Interactive TUI dispatcher + shared helpers.
#
# All TUI surfaces (fzf, fallback, gum) share visual vocabulary from DESIGN.md.
# Helpers exported here:
#   ccws_tui_engine          → which renderer to use this run
#   ccws_tui_collect_workspaces → "name | endpoint | proxy | mtime" lines
#   ccws_tui_short_endpoint  → normalize endpoint URL to short label
#   ccws_tui_truncate        → trim string to N visible cols with "…"
#   ccws_tui_ghost_hint      → dim footer string when CCWS_NAME points at a deleted workspace
#   ccws_tui_active_index    → 0-indexed row of the active workspace in the rendered list, or -1
#   CCWS_PREVIEW_KEYS        → ordered "env|label" pairs for the picker preview
#   _ccws_tui_cols           → terminal column count from $COLUMNS / tput / stty
#   _ccws_fzf_min_version    → return 0 if fzf ≥ 0.44 (required by ccws_tui_fzf_pick flags)

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_ENV_LOADED:-}"    ]] && source "$_libdir/env.sh"

# Preview key/value table — env-var name | display label, rendered in this order.
# Keys present in ccws.env but absent from this list are silently NOT shown in
# the preview. To expose a new key, add it here. (See DESIGN.md "Preview".)
# IMPORTANT: every proxy env var that ccws_env_has_proxy accepts (HTTP_PROXY,
# HTTPS_PROXY, ALL_PROXY in both upper and lower case) appears here, otherwise
# a workspace could route Claude traffic through a proxy that the preview
# hides from the user.
CCWS_PREVIEW_KEYS=(
    "ANTHROPIC_BASE_URL|endpoint"
    "HTTPS_PROXY|proxy"
    "https_proxy|proxy"
    "HTTP_PROXY|proxy"
    "http_proxy|proxy"
    "ANTHROPIC_MODEL|model"
    "ANTHROPIC_AUTH_TOKEN|token"
    "CCWS_CREATED|created"
    "CCWS_DESCRIPTION|description"
    "ANTHROPIC_DEFAULT_OPUS_MODEL|opus"
    "ANTHROPIC_DEFAULT_SONNET_MODEL|sonnet"
    "ANTHROPIC_DEFAULT_HAIKU_MODEL|haiku"
    "CLAUDE_CODE_EFFORT_LEVEL|effort"
    "CLAUDE_CODE_SUBAGENT_MODEL|subagent"
    "ALL_PROXY|socks"
    "all_proxy|socks"
    "NO_PROXY|no_proxy"
    "no_proxy|no_proxy"
    "CCWS_BINARY|binary"
)
export CCWS_PREVIEW_KEYS

# Shared 32-char horizontal divider. Used by both fzf and fallback pickers to
# keep the cross-engine alignment in DESIGN.md L43 honest — change here and
# both surfaces follow.
CCWS_TUI_RULE='────────────────────────────────'
export CCWS_TUI_RULE

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

# Multi-source terminal width detection. $COLUMNS isn't always exported into
# subprocesses (notably the `claude` wrapper that invokes `ccws`), so fall
# back to tput, then stty, then a default of 80. A reported width of 0 (tty
# absent in non-interactive contexts like bats / CI) is treated as missing
# and falls through to the next source — otherwise the engine would always
# route to the fallback in CI even on machines with fzf installed.
_ccws_tui_cols() {
    local c=""
    if [[ -n "${COLUMNS:-}" ]] && [[ "$COLUMNS" =~ ^[0-9]+$ ]] && [[ "$COLUMNS" -gt 0 ]]; then
        printf '%s\n' "$COLUMNS"
        return
    fi
    if command -v tput >/dev/null 2>&1; then
        c=$(tput cols 2>/dev/null)
        if [[ "$c" =~ ^[0-9]+$ ]] && [[ "$c" -gt 0 ]]; then
            printf '%s\n' "$c"
            return
        fi
    fi
    if command -v stty >/dev/null 2>&1; then
        c=$(stty size 2>/dev/null | awk '{print $2}')
        if [[ "$c" =~ ^[0-9]+$ ]] && [[ "$c" -gt 0 ]]; then
            printf '%s\n' "$c"
            return
        fi
    fi
    printf '%s\n' 80
}

# Returns 0 (success) when fzf reports ≥ 0.44. The picker uses --height=~N,
# --min-height, and --bind start:pos(N) which all require 0.44+. Older fzf
# versions get routed to the fallback to avoid runtime `unknown option` errors.
_ccws_fzf_min_version() {
    local v maj min rest
    v=$(fzf --version 2>/dev/null | awk '{print $1}')
    [[ -z "$v" ]] && return 1
    maj="${v%%.*}"
    rest="${v#*.}"
    min="${rest%%.*}"
    [[ "$maj" =~ ^[0-9]+$ ]] || return 1
    [[ "$min" =~ ^[0-9]+$ ]] || return 1
    [[ "$maj" -gt 0 ]] && return 0
    [[ "$min" -ge 44 ]]
}

# Returns the dim footer hint string when $CCWS_NAME is set in the current
# shell but the named workspace directory does not exist (e.g. user `ccws rm`d
# it from another shell). Empty string when no ghost is present.
ccws_tui_ghost_hint() {
    local c_dim=$'\033[38;2;108;112;134m'
    local c_rs=$'\033[0m'
    if [[ -n "${CCWS_NAME:-}" && ! -d "$(ccws_workspaces_dir)/$CCWS_NAME" ]]; then
        printf '%s · CCWS_NAME=%s set but workspace not found%s' \
            "$c_dim" "$CCWS_NAME" "$c_rs"
    fi
}

# 0-indexed position of the active workspace in the rendered list. Returns -1
# when CCWS_NAME is unset or doesn't match any workspace. Used by tui_fzf to
# pre-position the cursor via `--bind="start:pos($idx)"` so re-running ccws on
# the already-active workspace is idempotent (one ↵ re-activates).
ccws_tui_active_index() {
    if [[ -z "${CCWS_NAME:-}" ]]; then
        printf '%s\n' '-1'
        return
    fi
    local i=0 n _e _p _m
    while IFS='|' read -r n _e _p _m; do
        n=$(printf '%s' "$n" | awk '{$1=$1};1')
        if [[ "$n" == "$CCWS_NAME" ]]; then
            printf '%s\n' "$i"
            return
        fi
        i=$((i + 1))
    done < <(ccws_tui_collect_workspaces)
    printf '%s\n' '-1'
}

ccws_tui_engine() {
    # CCWS_NO_TUI=1 means "I don't want / can't have an interactive fzf picker"
    # → use the numbered fallback. The fallback IS a usable picker; just simpler.
    # Same semantic as "fzf is not installed" — both route to fallback.
    if [[ "${CCWS_NO_TUI:-0}" == "1" ]]; then
        printf 'fallback\n'
        return
    fi
    local cols
    cols=$(_ccws_tui_cols)
    if [[ "$cols" =~ ^[0-9]+$ ]] && [[ "$cols" -lt 60 ]]; then
        printf 'fallback\n'
        return
    fi
    if command -v fzf >/dev/null 2>&1 && _ccws_fzf_min_version; then
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
    esac
}

export CCWS_TUI_LOADED=1
