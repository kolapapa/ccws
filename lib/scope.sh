#!/usr/bin/env bash
# Workspace scope resolution (pyenv-style local/global).
#
# Lookup order (highest priority first):
#   1. CCWS_NAME env var (explicit shell-scope via 'ccws use')
#   2. .ccws-workspace file in CWD or any parent (directory-scope)
#   3. ~/.ccws/global file (user-default)
#   4. unresolved (return 1)

# shellcheck disable=SC1091
_libdir="$(dirname "${BASH_SOURCE[0]}")"
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$_libdir/common.sh"

ccws_scope_local_filename() {
    printf '%s\n' '.ccws-workspace'
}

ccws_scope_global_file() {
    printf '%s\n' "$(ccws_root)/global"
}

# Walk up from $1 (default $PWD) looking for .ccws-workspace.
# Echoes the absolute path of the file if found; returns 1 if not.
ccws_scope_find_local() {
    local d="${1:-$PWD}"
    local marker
    marker=$(ccws_scope_local_filename)
    while [[ -n "$d" && "$d" != "/" ]]; do
        if [[ -f "$d/$marker" ]]; then
            printf '%s\n' "$d/$marker"
            return 0
        fi
        d="$(dirname "$d")"
    done
    # Also check root
    if [[ -f "/$marker" ]]; then
        printf '%s\n' "/$marker"
        return 0
    fi
    return 1
}

# Read first non-empty line, stripped of whitespace.
# Returns 1 if file missing/empty/contains only whitespace.
ccws_scope_read_file() {
    local f="$1"
    [[ -f "$f" ]] || return 1
    local content
    content=$(head -n1 "$f" 2>/dev/null | tr -d '[:space:]')
    [[ -n "$content" ]] || return 1
    printf '%s\n' "$content"
}

# Resolve the active workspace by walking the priority chain.
# Stdout: NAME<TAB>SOURCE
#   where SOURCE ∈ {shell, local:/abs/path, global}
# Returns 1 if nothing resolved.
ccws_scope_resolve() {
    if [[ -n "${CCWS_NAME:-}" ]]; then
        printf '%s\tshell\n' "$CCWS_NAME"
        return 0
    fi
    local localfile name
    if localfile=$(ccws_scope_find_local); then
        if name=$(ccws_scope_read_file "$localfile"); then
            printf '%s\tlocal:%s\n' "$name" "$localfile"
            return 0
        fi
    fi
    local globalfile
    globalfile=$(ccws_scope_global_file)
    if name=$(ccws_scope_read_file "$globalfile"); then
        printf '%s\tglobal\n' "$name"
        return 0
    fi
    return 1
}

export CCWS_SCOPE_LOADED=1
