import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnvFile } from './env.js';

const PROXY_KEYS = [
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'ALL_PROXY',
  'https_proxy',
  'http_proxy',
  'all_proxy',
];

export interface Workspace {
  name: string;
  endpoint: string;
  proxy: boolean;
  dangerous: boolean;
  /** CCWS_NO_ISOLATE=1 — workspace ships its env but uses ~/.claude (no per-ws CLAUDE_CONFIG_DIR). */
  noIsolate: boolean;
  active: boolean;
  envPath: string;
  env: Record<string, string>;
  mtime: number;
}

export interface ScanOptions {
  workspacesDir: string;
  activeName: string | null;
}

export function scanWorkspaces(opts: ScanOptions): Workspace[] {
  const { workspacesDir, activeName } = opts;
  if (!existsSync(workspacesDir)) return [];
  const entries = readdirSync(workspacesDir);
  const out: Workspace[] = [];
  for (const name of entries) {
    const wsDir = join(workspacesDir, name);
    let st;
    try {
      st = statSync(wsDir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const envPath = join(wsDir, 'ccws.env');
    const env = parseEnvFile(envPath);
    const proxy = PROXY_KEYS.some((k) => k in env);
    const dangerous = env.CCWS_DANGEROUS === '1';
    const noIsolate = env.CCWS_NO_ISOLATE === '1';
    const endpoint = env.ANTHROPIC_BASE_URL || 'anthropic';
    out.push({
      name,
      endpoint,
      proxy,
      dangerous,
      noIsolate,
      active: activeName === name,
      envPath,
      env,
      mtime: st.mtimeMs,
    });
  }
  // Sort: home (noIsolate=true) workspaces first, then alphabetical by name.
  // Rationale: home workspaces don't have a private CLAUDE_CONFIG_DIR — they're
  // the "default" surface (one click → run with the user's everyday config),
  // so they should be top of the picker.
  out.sort((a, b) => {
    if (a.noIsolate !== b.noIsolate) return a.noIsolate ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export function defaultWorkspacesDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return join(home, '.ccws', 'workspaces');
}
