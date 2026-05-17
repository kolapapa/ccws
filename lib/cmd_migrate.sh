#!/usr/bin/env bash
# ccws migrate [--from FILE]
# Imports workspaces from ~/.claude-profiles.conf or specified file.

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}"        ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_ENV_LOADED:-}"           ]] && source "$_libdir/env.sh"
[[ -z "${CCWS_LOCK_LOADED:-}"          ]] && source "$_libdir/lock.sh"
[[ -z "${CCWS_SYMLINK_FARM_LOADED:-}"  ]] && source "$_libdir/symlink_farm.sh"

ccws_cmd_migrate() {
    local conf_file="$HOME/.claude-profiles.conf"
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --from) conf_file="$2"; shift 2 ;;
            *) ccws_log_error "unknown flag: $1"; return 2 ;;
        esac
    done

    if [[ ! -f "$conf_file" ]]; then
        ccws_log_error "migrate source not found: $conf_file"
        return 1
    fi

    local imported=0 skipped=0 empty=0
    local report=""

    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        [[ "$line" == \#* ]] && continue

        local name config_dir use_proxy enable_teams
        # shellcheck disable=SC2034  # use_proxy and enable_teams are parsed for format
        IFS='|' read -r name config_dir use_proxy enable_teams <<< "$line"

        if ! ccws_validate_name "$name" >/dev/null 2>&1; then
            report+="${name}: SKIP (invalid name)"$'\n'
            skipped=$((skipped + 1))
            continue
        fi

        local ws
        ws=$(ccws_ws_dir "$name")
        if [[ -d "$ws" ]]; then
            report+="${name}: SKIP (already exists)"$'\n'
            skipped=$((skipped + 1))
            continue
        fi

        # Capture libdir for subshell (local _libdir may not carry through)
        local libdir="$_libdir"

        if [[ -d "$config_dir" ]]; then
            ccws_with_lock 10 -- bash -c "
                set -e
                source '$libdir/common.sh'
                source '$libdir/env.sh'
                source '$libdir/symlink_farm.sh'
                mkdir -p '$ws'
                ccws_env_write '$name' --description 'migrated from $config_dir'
                CCWS_REAL_CLAUDE_DIR='$config_dir' ccws_symlink_farm_create '$name'
            "
            report+="${name}: imported (source=${config_dir})"$'\n'
            imported=$((imported + 1))
        else
            ccws_with_lock 10 -- bash -c "
                set -e
                source '$libdir/common.sh'
                source '$libdir/env.sh'
                source '$libdir/symlink_farm.sh'
                mkdir -p '$ws'
                ccws_env_write '$name' --description 'empty workspace (no existing dir found at $config_dir)'
                ccws_symlink_farm_create '$name'
            "
            report+="${name}: created empty workspace (no existing dir found)"$'\n'
            empty=$((empty + 1))
        fi
    done < "$conf_file"

    printf '\n=== migrate summary ===\n%s' "$report" >&2
    printf 'imported: %d  empty: %d  skipped: %d\n' "$imported" "$empty" "$skipped" >&2
}

export CCWS_CMD_MIGRATE_LOADED=1
