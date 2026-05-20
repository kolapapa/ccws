import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { envFile, wsDir } from '../paths.js';
import { parseEnvFile } from '../env.js';
import { validateName } from '../validate.js';
import { logError } from '../logger.js';
import { shQuote } from '../shellQuote.js';

// Keys ccws owns: they describe the workspace itself, not the user's
// runtime config, so they MUST NOT leak into the activated shell.
// (CCWS_NAME is set explicitly elsewhere; CCWS_CREATED / CCWS_DESCRIPTION
// are metadata for `ccws list --verbose`.)
const INTERNAL_META = new Set(['CCWS_NAME', 'CCWS_CREATED', 'CCWS_DESCRIPTION']);

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

  const exportedKeys: string[] = ['CCWS_NAME', 'CCWS_REAL_HOME', 'CLAUDE_CONFIG_DIR'];
  const lines: string[] = [];
  lines.push(`export CCWS_NAME=${shQuote(name)}`);
  lines.push(`export CCWS_REAL_HOME=${shQuote(process.env.HOME ?? '')}`);
  lines.push(`export CLAUDE_CONFIG_DIR=${shQuote(ws)}`);

  const env = parseEnvFile(envFile(name));
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
