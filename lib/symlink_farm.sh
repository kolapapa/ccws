#!/usr/bin/env bash
# Symlink farm: link shared config from ~/.claude/ into each workspace.

# shellcheck disable=SC1091
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

# Items symlinked from ~/.claude/ to each workspace
CCWS_SHARED_ITEMS=(
    settings.json
    settings.local.json
    CLAUDE.md
    commands
    mcp.json
    hooks.json
    hooks
    plugins
    skills
)

ccws_real_claude_dir() {
    printf '%s\n' "${CCWS_REAL_CLAUDE_DIR:-$HOME/.claude}"
}

# Create symlinks for items that exist in ~/.claude/. Idempotent.
ccws_symlink_farm_create() {
    local name="$1"
    local ws
    ws=$(ccws_ws_dir "$name")
    local src
    src=$(ccws_real_claude_dir)
    mkdir -p "$ws"

    local item
    for item in "${CCWS_SHARED_ITEMS[@]}"; do
        local source_path="$src/$item"
        local target_path="$ws/$item"
        if [[ -e "$source_path" || -L "$source_path" ]]; then
            # BSD `ln -sfn` won't replace an existing real directory — it would
            # create a symlink INSIDE the dir. Detect and remove first.
            if [[ -d "$target_path" && ! -L "$target_path" ]]; then
                rm -rf "$target_path"
            fi
            ln -sfn "$source_path" "$target_path"
        fi
    done
}

# Returns 0 if all current symlinks resolve. Reports broken ones to stderr.
ccws_symlink_farm_verify() {
    local name="$1"
    local ws
    ws=$(ccws_ws_dir "$name")
    local broken=0

    local item
    for item in "${CCWS_SHARED_ITEMS[@]}"; do
        local lp="$ws/$item"
        if [[ -L "$lp" && ! -e "$lp" ]]; then
            ccws_log_warn "symlink broken: $lp -> $(readlink "$lp")"
            broken=$((broken + 1))
        fi
    done
    [[ "$broken" -eq 0 ]]
}

# Sync: remove dangling, add new ones for items that newly appeared in ~/.claude/.
ccws_symlink_farm_sync() {
    local name="$1"
    local ws
    ws=$(ccws_ws_dir "$name")
    local src
    src=$(ccws_real_claude_dir)

    local item
    # Remove dangling
    for item in "${CCWS_SHARED_ITEMS[@]}"; do
        local lp="$ws/$item"
        if [[ -L "$lp" && ! -e "$lp" ]]; then
            rm "$lp"
        fi
    done

    # Re-create from scratch (idempotent)
    ccws_symlink_farm_create "$name"

    # Remove symlinks whose source disappeared
    for item in "${CCWS_SHARED_ITEMS[@]}"; do
        local lp="$ws/$item"
        local sp="$src/$item"
        if [[ -L "$lp" && ! -e "$sp" && ! -L "$sp" ]]; then
            rm "$lp"
        fi
    done
}

export CCWS_SYMLINK_FARM_LOADED=1
