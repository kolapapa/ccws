import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isValidKey(key: string): boolean {
  return KEY_RE.test(key);
}

export function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf8');
  const out: Record<string, string> = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq);
    const value = line.slice(eq + 1);
    if (!isValidKey(key)) continue;
    out[key] = value;
  }
  return out;
}

export function setEnvKey(path: string, key: string, value: string): void {
  if (!isValidKey(key)) throw new Error(`invalid env key: ${key}`);
  const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const lines = text.split('\n');
  let replaced = false;
  const updated = lines.map((line) => {
    if (replaced) return line;
    const eq = line.indexOf('=');
    if (eq < 0) return line;
    if (line.slice(0, eq) !== key) return line;
    replaced = true;
    return `${key}=${value}`;
  });
  let final = updated.join('\n');
  if (!replaced) {
    if (final.endsWith('\n') || final === '') {
      final += `${key}=${value}\n`;
    } else {
      final += `\n${key}=${value}\n`;
    }
  }
  writeFileSync(path, final);
}

export function unsetEnvKey(path: string, key: string): void {
  if (!isValidKey(key)) throw new Error(`invalid env key: ${key}`);
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  const kept = lines.filter((line) => {
    const eq = line.indexOf('=');
    if (eq < 0) return true;
    return line.slice(0, eq) !== key;
  });
  writeFileSync(path, kept.join('\n'));
}

export interface WriteEnvOptions {
  name: string;
  baseUrl?: string;
  token?: string;
  binary?: string;
  description?: string;
  proxy?: string;
}

function isoNowUTC(): string {
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
}

export function writeEnvFile(path: string, opts: WriteEnvOptions): void {
  mkdirSync(dirname(path), { recursive: true });
  const lines: string[] = [
    '# ccws workspace env file',
    '# created by ccws — chmod 600',
    `CCWS_NAME=${opts.name}`,
    `CCWS_CREATED=${isoNowUTC()}`,
  ];
  if (opts.baseUrl && opts.baseUrl !== '')         lines.push(`ANTHROPIC_BASE_URL=${opts.baseUrl}`);
  if (opts.token && opts.token !== '')             lines.push(`ANTHROPIC_AUTH_TOKEN=${opts.token}`);
  if (opts.binary && opts.binary !== '')           lines.push(`CCWS_BINARY=${opts.binary}`);
  if (opts.description && opts.description !== '') lines.push(`CCWS_DESCRIPTION=${opts.description}`);
  if (opts.proxy && opts.proxy !== '') {
    lines.push(`HTTPS_PROXY=${opts.proxy}`);
    lines.push(`HTTP_PROXY=${opts.proxy}`);
  }
  writeFileSync(path, `${lines.join('\n')}\n`);
  chmodSync(path, 0o600);
}
