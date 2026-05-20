import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { envFile, wsDir } from '../paths.js';
import { parseEnvFile } from '../env.js';
import { validateName } from '../validate.js';
import { logError } from '../logger.js';
import { shQuote } from '../shellQuote.js';

// Keys ccws owns: they describe the workspace itself, not the user's
// runtime config, so they MUST NOT leak into the activated shell.
// CCWS_NO_ISOLATE is a workspace-level flag (see below) — it controls
// behavior, not env state, so it's also internal.
const INTERNAL_META = new Set([
  'CCWS_NAME', 'CCWS_CREATED', 'CCWS_DESCRIPTION', 'CCWS_NO_ISOLATE',
]);

// Only valid POSIX identifiers can be exported — anything else would be a
// shell-injection hazard. (The parser already filters, but defense in depth.)
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isExportable(key: string): boolean {
  if (INTERNAL_META.has(key)) return false;
  return KEY_RE.test(key);
}

export async function runUse(argv: string[]): Promise<number> {
  const name = argv[0];
  if (name === undefined) {
    logError('usage: ccws use <name>');
    return 2;
  }
  const v = validateName(name);
  if (!v.ok) {
    logError(v.reason);
    return 2;
  }
  const ws = wsDir(name);
  if (!existsSync(ws)) {
    logError(`workspace not found: ${name}`);
    return 1;
  }

  const env = parseEnvFile(envFile(name));

  // CCWS_NO_ISOLATE=1 in ccws.env declares this workspace as "bare" — the
  // user wants its tokens/endpoint but NOT a private CLAUDE_CONFIG_DIR.
  // Use case: a 'default' workspace that pins your everyday API config but
  // lets ~/.claude (the global plugin / settings dir) own everything else.
  // We still export CCWS_NAME so `ccws current` / picker can tell which
  // workspace is active.
  const noIsolate = env.CCWS_NO_ISOLATE === '1';

  const exportedKeys: string[] = ['CCWS_NAME'];
  const lines: string[] = [];
  lines.push(`export CCWS_NAME=${shQuote(name)}`);
  if (!noIsolate) {
    lines.push(`export CCWS_REAL_HOME=${shQuote(process.env.HOME ?? '')}`);
    lines.push(`export CLAUDE_CONFIG_DIR=${shQuote(ws)}`);
    exportedKeys.push('CCWS_REAL_HOME', 'CLAUDE_CONFIG_DIR');
  }

  for (const [key, value] of Object.entries(env)) {
    if (!isExportable(key)) continue;
    if (key === 'CCWS_BINARY') {
      lines.push(`export CCWS_BINARY=${shQuote(value)}`);
      const newPath = `${dirname(value)}:${process.env.PATH ?? ''}`;
      lines.push(`export PATH=${shQuote(newPath)}`);
      exportedKeys.push('CCWS_BINARY', 'PATH');
      continue;
    }
    lines.push(`export ${key}=${shQuote(value)}`);
    exportedKeys.push(key);
  }

  lines.push(`export CCWS_EXPORTED=${exportedKeys.join(',')}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}
