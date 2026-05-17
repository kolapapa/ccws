# /whoami — show current ccws workspace

Show which ccws workspace is active in the current shell session.

```bash
echo "ccws workspace: ${CCWS_NAME:-(none)}"
echo "CLAUDE_CONFIG_DIR: ${CLAUDE_CONFIG_DIR:-(not set)}"
echo "Endpoint: ${ANTHROPIC_BASE_URL:-anthropic (default)}"
```
