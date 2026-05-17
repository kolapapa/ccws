#!/usr/bin/env bash
# ccws list [--verbose]

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_ENV_LOADED:-}"    ]] && source "$_libdir/env.sh"

ccws_cmd_list() {
    local verbose=0
    [[ "${1:-}" == "--verbose" || "${1:-}" == "-v" ]] && verbose=1

    local ws_dir
    ws_dir=$(ccws_workspaces_dir)
    if [[ ! -d "$ws_dir" ]]; then
        ccws_log_info "no workspaces yet — run 'ccws add <name>'"
        return 0
    fi

    local count=0
    for d in "$ws_dir"/*/; do
        [[ -d "$d" ]] || continue
        local name
        name=$(basename "$d")
        local marker=" "
        [[ "${CCWS_NAME:-}" == "$name" ]] && marker="*"
        if [[ "$verbose" -eq 1 ]]; then
            local base_url
            base_url=$(ccws_env_get "$name" ANTHROPIC_BASE_URL || true)
            local created
            created=$(ccws_env_get "$name" CCWS_CREATED || true)
            printf '%s %s  endpoint=%s  created=%s\n' \
                "$marker" "$name" \
                "${base_url:-anthropic}" \
                "${created:-?}"
        else
            printf '%s %s\n' "$marker" "$name"
        fi
        count=$((count + 1))
    done

    [[ "$count" -eq 0 ]] && ccws_log_info "no workspaces yet"
    return 0
}

export CCWS_CMD_LIST_LOADED=1
