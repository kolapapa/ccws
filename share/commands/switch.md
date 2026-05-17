# /switch — switching workspaces guidance

Claude can't change shell env vars at runtime. To switch workspaces:

1. Exit this claude session (Ctrl-D or /exit)
2. In your shell, run:
   ```bash
   ccws use <workspace>
   ```
   Or use the interactive picker:
   ```bash
   ccws
   ```
3. Start `claude` again — it will pick up the new workspace's `CLAUDE_CONFIG_DIR`

To see available workspaces: `ccws list`
