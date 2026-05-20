const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const FALLBACK = [
  'CCWS_NAME',
  'CCWS_REAL_HOME',
  'CLAUDE_CONFIG_DIR',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'CCWS_BINARY',
];

export async function runUnset(_argv: string[]): Promise<number> {
  const tracked = process.env.CCWS_EXPORTED ?? '';
  const lines: string[] = [];
  if (tracked === '') {
    for (const k of FALLBACK) lines.push(`unset ${k}`);
  } else {
    for (const k of tracked.split(',')) {
      const trimmed = k.trim();
      if (!KEY_RE.test(trimmed)) continue;
      lines.push(`unset ${trimmed}`);
    }
  }
  lines.push('unset CCWS_EXPORTED');
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}
