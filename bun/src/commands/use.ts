import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { envFile, wsDir } from '../paths.js';
import { parseEnvFile } from '../env.js';
import { validateName } from '../validate.js';
import { logError } from '../logger.js';
import { shQuote } from '../shellQuote.js';

const INTERNAL_META = new Set(['CCWS_NAME', 'CCWS_CREATED', 'CCWS_DESCRIPTION']);
const PROXY_KEYS_BOTH_CASES = new Set([
  'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NO_PROXY',
  'https_proxy', 'http_proxy', 'all_proxy', 'no_proxy',
]);

function isAllowed(key: string): boolean {
  if (INTERNAL_META.has(key)) return false;
  if (key === 'CCWS_BINARY') return true;
  if (key.startsWith('ANTHROPIC_')) return true;
  if (key.startsWith('CLAUDE_')) return true;
  if (key.startsWith('CCWS_')) return true;
  if (PROXY_KEYS_BOTH_CASES.has(key)) return true;
  return false;
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
    if (!isAllowed(key)) continue;
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
