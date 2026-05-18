#!/usr/bin/env bash
# ccws.env file parser/writer

# Source common.sh defensively (already loaded in normal flow)
# shellcheck disable=SC1091
[[ -z "${CCWS_COMMON_LOADED:-}" ]] && source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

ccws_env_file() {
    printf '%s\n' "$(ccws_ws_dir "$1")/ccws.env"
}

# Usage: ccws_env_write <name> [--base-url URL] [--token TOK] [--binary PATH] [--description DESC] [--proxy URL]
ccws_env_write() {
    local name="$1"; shift
    local base_url="" token="" binary="" description="" proxy=""
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --base-url)    base_url="$2"; shift 2 ;;
            --token)       token="$2";    shift 2 ;;
            --binary)      binary="$2";   shift 2 ;;
            --description) description="$2"; shift 2 ;;
            --proxy)       proxy="$2";    shift 2 ;;
            *) ccws_log_error "unknown ccws_env_write flag: $1"; return 1 ;;
        esac
    done

    local envfile
    envfile=$(ccws_env_file "$name")
    mkdir -p "$(dirname "$envfile")"

    {
        echo "# ccws workspace env file"
        echo "# created by ccws — chmod 600"
        echo "CCWS_NAME=$name"
        echo "CCWS_CREATED=$(date -u +%FT%TZ)"
        [[ -n "$base_url"    ]] && echo "ANTHROPIC_BASE_URL=$base_url"
        [[ -n "$token"       ]] && echo "ANTHROPIC_AUTH_TOKEN=$token"
        [[ -n "$binary"      ]] && echo "CCWS_BINARY=$binary"
        [[ -n "$description" ]] && echo "CCWS_DESCRIPTION=$description"
        if [[ -n "$proxy" ]]; then
            echo "HTTPS_PROXY=$proxy"
            echo "HTTP_PROXY=$proxy"
        fi
    } > "$envfile"
    chmod 600 "$envfile"
}

# Source ccws.env values into the current shell (export them)
ccws_env_read() {
    local name="$1"
    local envfile
    envfile=$(ccws_env_file "$name")
    if [[ ! -f "$envfile" ]]; then
        ccws_log_error "workspace not found: $name"
        return 1
    fi
    while IFS='=' read -r key value; do
        # skip comments and blanks
        [[ -z "$key" ]] && continue
        [[ "$key" == \#* ]] && continue
        [[ "$key" == *[![:alnum:]_]* ]] && continue
        export "$key=$value"
    done < "$envfile"
}

# Read a single key (without exporting). Echoes value or empty.
ccws_env_get() {
    local name="$1" key="$2"
    # Reject any key that isn't a valid identifier (prevents grep regex injection)
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || return 1
    local envfile
    envfile=$(ccws_env_file "$name")
    [[ -f "$envfile" ]] || return 1
    grep -m1 "^${key}=" "$envfile" | cut -d= -f2-
}

# Returns 0 if ccws.env defines any HTTP/SOCKS proxy var, 1 otherwise.
ccws_env_has_proxy() {
    local name="$1"
    local envfile
    envfile=$(ccws_env_file "$name")
    [[ -f "$envfile" ]] || return 1
    grep -qE '^(HTTPS?_PROXY|ALL_PROXY|https?_proxy|all_proxy)=' "$envfile"
}

export CCWS_ENV_LOADED=1
