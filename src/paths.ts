// bun/src/paths.ts
import { join } from 'node:path';

function home(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? '';
}

export function ccwsRoot(): string {
  return process.env.CCWS_ROOT ?? join(home(), '.ccws');
}

export function workspacesDir(): string {
  return join(ccwsRoot(), 'workspaces');
}

export function wsDir(name: string): string {
  return join(workspacesDir(), name);
}

export function envFile(name: string): string {
  return join(wsDir(name), 'ccws.env');
}

export function lockFile(): string {
  return join(ccwsRoot(), 'lock');
}

export function globalScopeFile(): string {
  return join(ccwsRoot(), 'global');
}

export function realClaudeDir(): string {
  return process.env.CCWS_REAL_CLAUDE_DIR ?? join(home(), '.claude');
}
