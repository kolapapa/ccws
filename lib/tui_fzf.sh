#!/usr/bin/env bash
# fzf-based TUI with preview pane.

ccws_tui_fzf_pick() {
    local lines
    lines=$(ccws_tui_collect_workspaces)
    [[ -z "$lines" ]] && { ccws_log_info "no workspaces"; return 1; }

    local prompt="› "
    # shellcheck disable=SC2016
    local preview_cmd='
        ws_name=$(echo {} | cut -d"|" -f1 | xargs)
        ws_dir="'"$HOME"'/.ccws/workspaces/$ws_name"
        echo "Workspace: $ws_name"
        echo "Path:      $ws_dir"
        if [[ -f "$ws_dir/ccws.env" ]]; then
            echo ""
            echo "--- ccws.env ---"
            grep -vE "^(#|$)" "$ws_dir/ccws.env" | sed "s/AUTH_TOKEN=.*/AUTH_TOKEN=***/"
        fi
    '

    local selected
    selected=$(printf '%s\n' "$lines" | fzf \
        --prompt="$prompt" \
        --header="ccws · select workspace · Enter to activate · ESC to cancel" \
        --preview="$preview_cmd" \
        --preview-window=right:50%:wrap \
        --height=80% \
        --reverse)

    [[ -z "$selected" ]] && return 1
    echo "$selected" | cut -d'|' -f1 | xargs
}

export CCWS_TUI_FZF_LOADED=1
