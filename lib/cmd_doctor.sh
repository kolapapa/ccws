#!/usr/bin/env bash
# ccws doctor — 7 health checks

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}"        ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_ENV_LOADED:-}"           ]] && source "$_libdir/env.sh"
[[ -z "${CCWS_SYMLINK_FARM_LOADED:-}"  ]] && source "$_libdir/symlink_farm.sh"

ccws_cmd_doctor() {
    local warns=0 errors=0

    _doctor_check() {
        local label="$1" status="$2" detail="$3"
        case "$status" in
            ok)    printf '  \033[32m✓\033[0m %s\n' "$label" ;;
            warn)  printf '  \033[33m!\033[0m %s — %s\n' "$label" "$detail"; warns=$((warns + 1)) ;;
            error) printf '  \033[31m✗\033[0m %s — %s\n' "$label" "$detail"; errors=$((errors + 1)) ;;
        esac
    }

    echo "ccws doctor — environment health checks"
    echo ""

    # 1. ~/.claude/ exists
    if [[ -d "$(ccws_real_claude_dir)" ]]; then
        # shellcheck disable=SC2088
        _doctor_check "~/.claude/ exists" ok ""
    else
        # shellcheck disable=SC2088
        _doctor_check "~/.claude/ missing — run 'claude' once to initialize, then 'ccws sync'" warn "~/.claude/ not found"
    fi

    # 2. ~/.ccws/ structure exists
    if [[ -d "$(ccws_root)" ]]; then
        # shellcheck disable=SC2088
        _doctor_check "~/.ccws/ initialized" ok ""
    else
        # shellcheck disable=SC2088
        _doctor_check "~/.ccws/ missing" warn "run 'ccws add <name>' to create first workspace"
    fi

    # 3. Symlink integrity for all workspaces
    local ws_dir
    ws_dir=$(ccws_workspaces_dir)
    if [[ -d "$ws_dir" ]]; then
        for d in "$ws_dir"/*/; do
            [[ -d "$d" ]] || continue
            local n
            n=$(basename "$d")
            if ccws_symlink_farm_verify "$n" >/dev/null 2>&1; then
                _doctor_check "workspace '$n' symlinks ok" ok ""
            else
                _doctor_check "workspace '$n' has broken symlinks" warn "run 'ccws sync $n'"
            fi
        done
    fi

    # 4. ccws.env validity per workspace
    if [[ -d "$ws_dir" ]]; then
        for d in "$ws_dir"/*/; do
            [[ -d "$d" ]] || continue
            local n
            n=$(basename "$d")
            local envfile
            envfile=$(ccws_env_file "$n")
            if [[ -f "$envfile" ]]; then
                local cur_name
                cur_name=$(ccws_env_get "$n" CCWS_NAME || true)
                if [[ "$cur_name" == "$n" ]]; then
                    _doctor_check "workspace '$n' env valid" ok ""
                else
                    _doctor_check "workspace '$n' env has wrong CCWS_NAME" warn "found '$cur_name'"
                fi
            else
                _doctor_check "workspace '$n' missing ccws.env" error "re-run 'ccws add' or hand-create"
            fi
        done
    fi

    # 5. External CLAUDE_CONFIG_DIR (warn if set outside ccws)
    if [[ -n "${CLAUDE_CONFIG_DIR:-}" && -z "${CCWS_NAME:-}" ]]; then
        _doctor_check "CLAUDE_CONFIG_DIR set outside ccws" warn "${CLAUDE_CONFIG_DIR} — may conflict"
    fi

    # 6. claude binary on PATH
    if command -v claude >/dev/null 2>&1; then
        _doctor_check "claude binary on PATH" ok ""
    else
        _doctor_check "claude binary not on PATH" error "install Claude Code first"
    fi

    # 7. Shell rc integration
    local found_init=0
    for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.config/fish/config.fish"; do
        if [[ -f "$rc" ]] && grep -q "ccws" "$rc" 2>/dev/null; then
            found_init=1
            break
        fi
    done
    if [[ "$found_init" -eq 1 ]]; then
        _doctor_check "shell rc has ccws init" ok ""
    else
        _doctor_check "shell rc missing ccws init" warn "run install.sh to wire it up"
    fi

    echo ""
    printf 'summary: %d warning(s), %d error(s)\n' "$warns" "$errors"
    [[ "$errors" -eq 0 ]]
}

export CCWS_CMD_DOCTOR_LOADED=1
