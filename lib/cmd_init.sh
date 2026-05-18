#!/usr/bin/env bash
# ccws init — first-time setup wizard.

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}"        ]] && source "$_libdir/common.sh"
[[ -z "${CCWS_ENV_LOADED:-}"           ]] && source "$_libdir/env.sh"
[[ -z "${CCWS_LOCK_LOADED:-}"          ]] && source "$_libdir/lock.sh"
[[ -z "${CCWS_SYMLINK_FARM_LOADED:-}"  ]] && source "$_libdir/symlink_farm.sh"
[[ -z "${CCWS_CMD_ADD_LOADED:-}"       ]] && source "$_libdir/cmd_add.sh"

# Tiny prompt helper — returns 0 for yes, 1 for no.
_ccws_init_prompt_yn() {
    local question="$1" default="${2:-Y}"
    local hint="[Y/n]"
    [[ "$default" == "N" ]] && hint="[y/N]"
    printf '%s %s ' "$question" "$hint" >&2
    local r
    IFS= read -r r
    [[ -z "$r" ]] && r="$default"
    case "$r" in
        y|Y|yes|YES) return 0 ;;
        *) return 1 ;;
    esac
}

ccws_cmd_init() {
    local reset=0
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --reset) reset=1; shift ;;
            --help|-h)
                cat <<'EOF' >&2
ccws init — interactive first-time setup

Usage: ccws init [--reset]

  --reset   Remove ~/.ccws/ and start fresh (asks confirmation)
EOF
                return 0 ;;
            *) ccws_log_error "unknown flag: $1"; return 2 ;;
        esac
    done

    local ccws_dir
    ccws_dir=$(ccws_root)

    # --reset path
    if [[ "$reset" -eq 1 ]]; then
        if [[ -d "$ccws_dir" ]]; then
            printf '!! reset will delete %s and all workspaces. continue? [y/N] ' "$ccws_dir" >&2
            local r
            IFS= read -r r
            [[ "$r" == "y" || "$r" == "Y" ]] || { ccws_log_info "cancelled"; return 1; }
            rm -rf "$ccws_dir"
            ccws_log_ok "removed $ccws_dir"
        fi
    fi

    # If already initialized, show status and exit (idempotent for re-runs)
    if [[ -d "$(ccws_workspaces_dir)" ]] && [[ -n "$(ls -A "$(ccws_workspaces_dir)" 2>/dev/null)" ]]; then
        echo "ccws init — already initialized." >&2
        echo "" >&2
        echo "Current state:" >&2
        local ws_count
        ws_count=$(find "$(ccws_workspaces_dir)" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
        echo "  - $ws_count workspace(s)" >&2
        echo "" >&2
        echo "You might want one of:" >&2
        echo "  ccws add <name>     Add a new workspace" >&2
        echo "  ccws doctor         Health check" >&2
        echo "  ccws init --reset   Remove everything and start fresh" >&2
        return 0
    fi

    # Banner
    cat >&2 <<'EOF'

╔══════════════════════════════════════════════╗
║  ccws · first-time setup                     ║
╚══════════════════════════════════════════════╝

EOF

    # Bootstrap ~/.ccws structure
    mkdir -p "$ccws_dir/workspaces"

    # ===== Step 1: ~/.claude/ detection (informational + optional bootstrap) =====
    echo "[1/3] Checking ~/.claude/..." >&2
    echo "" >&2

    local real_claude
    real_claude=$(ccws_real_claude_dir)

    if [[ -d "$real_claude" ]]; then
        local plugins_count=0 skills_count=0
        [[ -d "$real_claude/plugins" ]] && plugins_count=$(find "$real_claude/plugins" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')
        [[ -d "$real_claude/skills" ]] && skills_count=$(find "$real_claude/skills" -mindepth 1 -maxdepth 1 | wc -l | tr -d ' ')

        echo "  ✓ Found existing Claude Code install at $real_claude" >&2
        echo "    plugins: $plugins_count · skills: $skills_count" >&2
        echo "" >&2
        echo "    Your existing setup stays as-is. Plain 'claude' keeps using it" >&2
        echo "    with your current account." >&2
        echo "    ccws is for ADDITIONAL workspaces (other accounts / gateways)." >&2
        echo "    All workspaces share plugins/skills from ~/.claude/." >&2
    else
        echo "  ! No ~/.claude/ found." >&2
        echo "" >&2
        echo "  ccws needs ~/.claude/ as the shared plugin store. Two options:" >&2
        echo "    [a] Cancel — run 'claude' once first to bootstrap, then re-run 'ccws init'" >&2
        echo "    [b] Bootstrap empty ~/.claude/ now" >&2
        echo "" >&2
        if _ccws_init_prompt_yn "  Bootstrap empty ~/.claude/?" N; then
            mkdir -p "$real_claude/commands" "$real_claude/plugins" "$real_claude/skills" "$real_claude/hooks"
            echo '{}' > "$real_claude/settings.json"
            ccws_log_ok "created empty $real_claude/"
        else
            ccws_log_info "cancelled. Run 'claude' once, then re-run 'ccws init'."
            return 0
        fi
    fi

    # ===== Step 2: Slash commands =====
    echo "" >&2
    echo "[2/3] Installing slash commands..." >&2

    local share_dir
    share_dir="$(cd "$_libdir/../share/commands" 2>/dev/null && pwd)"
    if [[ -d "$share_dir" ]]; then
        # Create ~/.claude/commands/ if it doesn't exist yet (common for users
        # whose Claude Code install never created it).
        mkdir -p "$real_claude/commands"
        cp -n "$share_dir/"*.md "$real_claude/commands/" 2>/dev/null || true
        ccws_log_ok "installed /whoami and /switch to $real_claude/commands/"
    else
        ccws_log_warn "could not install slash commands (share/commands not found at $_libdir/../share/commands)"
    fi

    # ===== Step 3: First new workspace =====
    echo "" >&2
    echo "[3/3] Add your first workspace?" >&2
    echo "      (for a different account or endpoint — leave blank to skip)" >&2
    echo "" >&2

    printf '  Workspace name (blank to skip): ' >&2
    local first_name
    IFS= read -r first_name

    if [[ -n "$first_name" ]]; then
        printf '  Endpoint URL (Anthropic default, blank to use it): ' >&2
        local first_url
        IFS= read -r first_url

        local first_token=""
        printf '  API token (paste, hidden; blank to skip — login later): ' >&2
        IFS= read -rs first_token
        echo "" >&2

        local add_args=("$first_name")
        [[ -n "$first_url"   ]] && add_args+=(--base-url "$first_url")
        [[ -n "$first_token" ]] && add_args+=(--token "$first_token")

        if ccws_cmd_add "${add_args[@]}" >/dev/null 2>&1; then
            ccws_log_ok "created workspace '$first_name'"
        else
            ccws_log_error "failed to create '$first_name'"
        fi
    else
        echo "  (skipped)" >&2
    fi

    # ===== Done =====
    echo "" >&2
    echo "Setup complete." >&2
    echo "" >&2
    echo "Workspaces:" >&2
    ccws_cmd_list 2>&1 || true
    echo "" >&2
    cat >&2 <<'EOF'
Next steps:
  ccws                  Open TUI picker
  ccws use <name>       Activate in this shell
  ccws add <name>       Add another workspace (or run interactively: ccws add)
  ccws doctor           Health check
  ccws --help           All commands

EOF
}

export CCWS_CMD_INIT_LOADED=1
