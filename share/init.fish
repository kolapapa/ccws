# ccws fish shell init — source this from ~/.config/fish/config.fish

if not set -q CCWS_DIR
    set -gx CCWS_DIR (cd (dirname (status -f))/.. && pwd)
end

function ccws --description "Claude Code WorkSpace switcher"
    set -l cmd $argv[1]
    set -l rest $argv[2..-1]

    switch "$cmd"
        case use
            set -l exports ($CCWS_DIR/bin/ccws use $rest)
            or return $status
            # Convert bash-style `export KEY=value` to fish `set -gx KEY value`
            for line in $exports
                if string match -qr '^export ' -- $line
                    set -l kv (string replace -r '^export ' '' -- $line | string split -m 1 '=')
                    set -l key $kv[1]
                    set -l val (string replace -ar "^'|'\$" '' -- $kv[2])
                    set -gx $key $val
                end
            end

        case unset
            set -l output ($CCWS_DIR/bin/ccws unset)
            # Parse `unset KEY` lines and clear each variable
            for line in $output
                if string match -qr '^unset ' -- $line
                    set -l key (string replace -r '^unset ' '' -- $line)
                    set -e $key 2>/dev/null
                end
            end

        case ""
            set -l exports ($CCWS_DIR/bin/ccws)
            or return $status
            if test (count $exports) -gt 0
                for line in $exports
                    if string match -qr '^export ' -- $line
                        set -l kv (string replace -r '^export ' '' -- $line | string split -m 1 '=')
                        set -l key $kv[1]
                        set -l val (string replace -ar "^'|'\$" '' -- $kv[2])
                        set -gx $key $val
                    end
                end
                read -P "Launch claude now? [Y/n] " r
                if test "$r" != "n" -a "$r" != "N"
                    claude
                end
            end

        case '*'
            $CCWS_DIR/bin/ccws $argv
    end
end
