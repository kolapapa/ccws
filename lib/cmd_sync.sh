#!/usr/bin/env bash
# ccws sync [<name>]  — re-link symlinks; if no name, all workspaces

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}"        ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_SYMLINK_FARM_LOADED:-}"  ]] && source "$_libdir/symlink_farm.sh"

ccws_cmd_sync() {
    local name="${1:-}"

    if [[ -n "$name" ]]; then
        ccws_validate_name "$name" || return 2
        local ws
        ws=$(ccws_ws_dir "$name")
        [[ -d "$ws" ]] || { ccws_log_error "workspace not found: $name"; return 1; }
        ccws_symlink_farm_sync "$name"
        ccws_log_ok "synced workspace '$name'"
        return 0
    fi

    local ws_dir
    ws_dir=$(ccws_workspaces_dir)
    [[ -d "$ws_dir" ]] || { ccws_log_info "no workspaces"; return 0; }

    local count=0
    for d in "$ws_dir"/*/; do
        [[ -d "$d" ]] || continue
        local n
        n=$(basename "$d")
        ccws_symlink_farm_sync "$n"
        count=$((count + 1))
    done
    ccws_log_ok "synced $count workspace(s)"
}

export CCWS_CMD_SYNC_LOADED=1
