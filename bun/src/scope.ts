import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { globalScopeFile } from './paths.js';

const LOCAL_MARKER = '.ccws-workspace';

export function findLocalFile(startDir: string = process.cwd()): string | null {
  let d = startDir;
  while (d && d !== '/') {
    const candidate = join(d, LOCAL_MARKER);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  const rootCandidate = join('/', LOCAL_MARKER);
  if (existsSync(rootCandidate)) return rootCandidate;
  return null;
}

export function readScopeFile(path: string): string | null {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.replace(/\s+/g, '');
    if (trimmed !== '') return trimmed;
  }
  return null;
}

export interface ResolvedScope {
  name: string;
  source: 'shell' | 'global' | `local:${string}`;
}

export function resolveScope(): ResolvedScope | null {
  const shellName = process.env.CCWS_NAME;
  if (shellName && shellName !== '') {
    return { name: shellName, source: 'shell' };
  }
  const localFile = findLocalFile();
  if (localFile) {
    const name = readScopeFile(localFile);
    if (name) return { name, source: `local:${localFile}` };
  }
  const gf = globalScopeFile();
  const globalName = readScopeFile(gf);
  if (globalName) return { name: globalName, source: 'global' };
  return null;
}
