#!/usr/bin/env bash
# Common bats setup helpers

# Resolve project root (used by all tests to find lib/)
export CCWS_PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Source a lib file safely
ccws_source() {
    # shellcheck source=/dev/null
    source "$CCWS_PROJECT_ROOT/lib/$1"
}
