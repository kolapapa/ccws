import {
  cpSync, existsSync, lstatSync, mkdirSync, rmSync, symlinkSync, unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { realClaudeDir, wsDir } from './paths.js';

export const SHARED_ITEMS = [
  'settings.json',
  'settings.local.json',
  'CLAUDE.md',
  'commands',
  'mcp.json',
  'hooks.json',
  'hooks',
  'plugins',
  'skills',
  'projects',
] as const;

// Items whose pre-existing per-workspace contents must be merged into the
// shared source before the target is replaced by a symlink, rather than
// discarded. Sharing `projects` lets `claude --continue/--resume` follow a
// session across an account switch instead of isolating history per workspace.
const MERGE_ON_LINK = new Set<string>(['projects']);

function isSymlink(p: string): boolean {
  try { return lstatSync(p).isSymbolicLink(); } catch { return false; }
}

function isRealDir(p: string): boolean {
  try {
    const st = lstatSync(p);
    return st.isDirectory() && !st.isSymbolicLink();
  } catch { return false; }
}

function linkOk(p: string): boolean {
  try { return existsSync(p); } catch { return false; }
}

// Copy `from` into `to` without clobbering: session files are uniquely named,
// so any entry already present in the shared dir wins and nothing is lost.
function mergeDir(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true, force: false, errorOnExist: false });
}

export function farmCreate(name: string): void {
  const ws = wsDir(name);
  const src = realClaudeDir();
  mkdirSync(ws, { recursive: true });
  for (const item of SHARED_ITEMS) {
    const source = join(src, item);
    const target = join(ws, item);
    const mergeable = MERGE_ON_LINK.has(item);
    if (!mergeable && !existsSync(source) && !isSymlink(source)) continue;
    if (isRealDir(target)) {
      if (mergeable) mergeDir(target, source); // preserve history before discarding
      rmSync(target, { recursive: true, force: true });
    }
    if (isSymlink(target)) unlinkSync(target);
    if (mergeable && !existsSync(source)) mkdirSync(source, { recursive: true });
    symlinkSync(source, target);
  }
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; broken: string[] };

export function farmVerify(name: string): VerifyResult {
  const ws = wsDir(name);
  const broken: string[] = [];
  for (const item of SHARED_ITEMS) {
    const p = join(ws, item);
    if (isSymlink(p) && !linkOk(p)) broken.push(p);
  }
  return broken.length === 0 ? { ok: true } : { ok: false, broken };
}

export function farmSync(name: string): void {
  const ws = wsDir(name);
  const src = realClaudeDir();
  for (const item of SHARED_ITEMS) {
    const p = join(ws, item);
    if (isSymlink(p) && !linkOk(p)) unlinkSync(p);
  }
  farmCreate(name);
  for (const item of SHARED_ITEMS) {
    const tgt = join(ws, item);
    const sp = join(src, item);
    if (isSymlink(tgt) && !existsSync(sp) && !isSymlink(sp)) unlinkSync(tgt);
  }
}
