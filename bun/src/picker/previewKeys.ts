// Ordered env→label list for the preview pane. Mirrors lib/tui.sh's
// CCWS_PREVIEW_KEYS. Label duplicates (e.g. HTTPS_PROXY and HTTP_PROXY
// both → 'proxy') are intentional; Preview.tsx dedups by label so the
// first matching env-var per label wins.
export interface PreviewKey {
  env: string;
  label: string;
}

export const PREVIEW_KEYS: readonly PreviewKey[] = [
  { env: 'ANTHROPIC_BASE_URL', label: 'endpoint' },
  { env: 'HTTPS_PROXY', label: 'proxy' },
  { env: 'https_proxy', label: 'proxy' },
  { env: 'HTTP_PROXY', label: 'proxy' },
  { env: 'http_proxy', label: 'proxy' },
  { env: 'ANTHROPIC_MODEL', label: 'model' },
  { env: 'ANTHROPIC_AUTH_TOKEN', label: 'token' },
  { env: 'CCWS_CREATED', label: 'created' },
  { env: 'CCWS_DESCRIPTION', label: 'description' },
  { env: 'ANTHROPIC_DEFAULT_OPUS_MODEL', label: 'opus' },
  { env: 'ANTHROPIC_DEFAULT_SONNET_MODEL', label: 'sonnet' },
  { env: 'ANTHROPIC_DEFAULT_HAIKU_MODEL', label: 'haiku' },
  { env: 'CLAUDE_CODE_EFFORT_LEVEL', label: 'effort' },
  { env: 'CLAUDE_CODE_SUBAGENT_MODEL', label: 'subagent' },
  { env: 'ALL_PROXY', label: 'socks' },
  { env: 'all_proxy', label: 'socks' },
  { env: 'NO_PROXY', label: 'no_proxy' },
  { env: 'no_proxy', label: 'no_proxy' },
  { env: 'CCWS_BINARY', label: 'binary' },
] as const;
