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
    local __ccws_rc
    # First launch: apply the resolved workspace env, then run claude.
    if [[ -n "\${CCWS_NAME:-}" ]]; then
        command claude "$@"
        __ccws_rc=$?
    else
        local __ccws_name __ccws_exports
        if __ccws_name=$(command ccws which 2>/dev/null) \\
            && __ccws_exports=$(command ccws use "$__ccws_name" 2>/dev/null); then
            ( eval "$__ccws_exports"; command claude "$@" )
            __ccws_rc=$?
        else
            command claude "$@"
            __ccws_rc=$?
        fi
    fi

    # Account-switch relaunch loop: '/switch <name>' (or 'ccws switch') records a
    # target workspace + session id; once claude exits, switch accounts and resume
    # that exact session. Loops so consecutive switches keep working.
    local __ccws_next __ccws_ws __ccws_sid
    while __ccws_next=$(command ccws switch --pop 2>/dev/null) && [[ -n "$__ccws_next" ]]; do
        read -r __ccws_ws __ccws_sid <<< "$__ccws_next"
        ccws use "$__ccws_ws" || break
        if [[ -n "$__ccws_sid" ]]; then
            command claude --resume "$__ccws_sid"
        else
            command claude --continue
        fi
        __ccws_rc=$?
    done
    return $__ccws_rc
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
  'switch.md': `# /switch — switch ccws account and resume this session

The user wants to switch the active ccws workspace/account (e.g. because the
current one ran out of quota) and continue THIS exact conversation under it.
Target workspace name: \`$ARGUMENTS\`

Claude cannot change the running shell's env or exit itself, so the actual switch
happens after the user exits. Your job is to arm it. Do this:

1. **No name given?** Run \`ccws current\` and \`ccws list\`, show the available
   workspaces, and tell the user to run \`/switch <name>\`. Then stop.

2. **Name given?** Arm the switch, capturing the current session so it resumes
   exactly (not just "most recent"):
   \`\`\`bash
   ccws switch "$ARGUMENTS" "$CLAUDE_CODE_SESSION_ID"
   \`\`\`

3. **If it succeeded**, tell the user verbatim:
   > ✅ Armed switch to \`$ARGUMENTS\`. Press **Ctrl-D** (or type \`/exit\`) now —
   > your shell will reopen this exact conversation on the \`$ARGUMENTS\` account.

   Do NOT attempt to exit on their behalf; you cannot. They must press Ctrl-D.

4. **If it failed**, show the error and run \`ccws list\` so they can pick a valid
   name.

Note: the automatic relaunch requires the claude() wrapper (\`ccws hook --claude\`).
Without it, the fallback is to exit and run \`ccws use <name> && claude --resume\`
manually.
`,
};
