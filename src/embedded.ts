// Shell wrappers embedded in the binary. `ccws hook` emits these directly
// (instead of `source <path>`) so v1.0 ships as a single binary with no
// disk-side share/ files needed.
//
// Each script's `ccws` function calls `command ccws` to bypass the shell
// function and invoke the binary on PATH. The no-arg branch chains
// picker → use internally so the wrapper sees a uniform "exports" eval
// even though the picker itself prints just the workspace name.

export const INIT_SH = `ccws() {
    local cmd="\${1:-}"
    case "$cmd" in
        use)
            shift
            local unset_cmds
            unset_cmds=$(command ccws unset 2>/dev/null) && eval "$unset_cmds"
            local exports
            exports=$(command ccws use "$@") || return $?
            eval "$exports"
            ;;
        unset)
            local exports
            exports=$(command ccws unset)
            eval "$exports"
            ;;
        "")
            local picked
            picked=$(command ccws) || return $?
            if [[ -n "$picked" ]]; then
                local unset_cmds
                unset_cmds=$(command ccws unset 2>/dev/null) && eval "$unset_cmds"
                local exports
                exports=$(command ccws use "$picked") || return $?
                eval "$exports"
                local launch_cmd=(claude)
                if [[ "\${CCWS_DANGEROUS:-0}" == "1" ]]; then
                    launch_cmd=(claude --dangerously-skip-permissions)
                    printf 'Launch claude --dangerously-skip-permissions now? [Y/n] ' >&2
                else
                    printf 'Launch claude now? [Y/n] ' >&2
                fi
                local r
                IFS= read -r r
                if [[ "$r" != "n" && "$r" != "N" ]]; then
                    "\${launch_cmd[@]}"
                fi
            fi
            ;;
        *)
            command ccws "$@"
            ;;
    esac
}
`;

export const INIT_FISH = `function ccws --description "Claude Code WorkSpace switcher"
    set -l cmd $argv[1]
    set -l rest $argv[2..-1]

    switch "$cmd"
        case use
            set -l exports (command ccws use $rest)
            or return $status
            for line in $exports
                if string match -qr '^export ' -- $line
                    set -l kv (string replace -r '^export ' '' -- $line | string split -m 1 '=')
                    set -l key $kv[1]
                    set -l val (string replace -ar "^'|'\\\$" '' -- $kv[2])
                    set -gx $key $val
                end
            end

        case unset
            set -l output (command ccws unset)
            for line in $output
                if string match -qr '^unset ' -- $line
                    set -l key (string replace -r '^unset ' '' -- $line)
                    set -e $key 2>/dev/null
                end
            end

        case ""
            set -l picked (command ccws)
            or return $status
            if test -n "$picked"
                set -l unset_output (command ccws unset)
                for line in $unset_output
                    if string match -qr '^unset ' -- $line
                        set -l key (string replace -r '^unset ' '' -- $line)
                        set -e $key 2>/dev/null
                    end
                end
                set -l exports (command ccws use $picked)
                or return $status
                for line in $exports
                    if string match -qr '^export ' -- $line
                        set -l kv (string replace -r '^export ' '' -- $line | string split -m 1 '=')
                        set -l key $kv[1]
                        set -l val (string replace -ar "^'|'\\\$" '' -- $kv[2])
                        set -gx $key $val
                    end
                end
                if test "$CCWS_DANGEROUS" = "1"
                    read -P "Launch claude --dangerously-skip-permissions now? [Y/n] " r
                    if test "$r" != "n" -a "$r" != "N"
                        claude --dangerously-skip-permissions
                    end
                else
                    read -P "Launch claude now? [Y/n] " r
                    if test "$r" != "n" -a "$r" != "N"
                        claude
                    end
                end
            end

        case '*'
            command ccws $argv
    end
end
`;

export const CLAUDE_WRAPPER = `claude() {
    if [[ -n "\${CCWS_NAME:-}" ]]; then
        command claude "$@"
        return $?
    fi

    local name
    if ! name=$(command ccws which 2>/dev/null); then
        command claude "$@"
        return $?
    fi

    local exports
    if ! exports=$(command ccws use "$name" 2>/dev/null); then
        command claude "$@"
        return $?
    fi

    (
        eval "$exports"
        command claude "$@"
    )
}
`;

export const SLASH_COMMANDS: Record<string, string> = {
  'whoami.md': `# /whoami — show current ccws workspace

Show which ccws workspace is active in the current shell session.

\`\`\`bash
echo "ccws workspace: \${CCWS_NAME:-(none)}"
echo "CLAUDE_CONFIG_DIR: \${CLAUDE_CONFIG_DIR:-(not set)}"
echo "Endpoint: \${ANTHROPIC_BASE_URL:-anthropic (default)}"
\`\`\`
`,
  'switch.md': `# /switch — switching workspaces guidance

Claude can't change shell env vars at runtime. To switch workspaces:

1. Exit this claude session (Ctrl-D or /exit)
2. In your shell, run:
   \`\`\`bash
   ccws use <workspace>
   \`\`\`
   Or use the interactive picker:
   \`\`\`bash
   ccws
   \`\`\`
3. Start \`claude\` again — it will pick up the new workspace's \`CLAUDE_CONFIG_DIR\`

To see available workspaces: \`ccws list\`
`,
};
