import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, lstatSync, readlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SHARED_ITEMS, farmCreate, farmVerify, farmSync } from '../src/symlinkFarm.js';

describe('symlinkFarm', () => {
  let tmp: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-farm-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    process.env.CCWS_REAL_CLAUDE_DIR = join(tmp, '.claude');
    mkdirSync(join(tmp, '.claude/commands'), { recursive: true });
    writeFileSync(join(tmp, '.claude/settings.json'), '{}');
    mkdirSync(join(tmp, '.claude/plugins'), { recursive: true });
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    process.env = origEnv;
  });

  it('SHARED_ITEMS lists the bash inventory exactly', () => {
    expect(SHARED_ITEMS).toEqual([
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
    ]);
  });

  it('farmCreate symlinks every existing item', () => {
    farmCreate('work');
    const ws = join(process.env.CCWS_ROOT!, 'workspaces/work');
    expect(lstatSync(join(ws, 'settings.json')).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(ws, 'commands')).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(ws, 'plugins')).isSymbolicLink()).toBe(true);
    expect(existsSync(join(ws, 'CLAUDE.md'))).toBe(false);
  });

  it('farmCreate is idempotent', () => {
    farmCreate('work');
    farmCreate('work');
    const ws = join(process.env.CCWS_ROOT!, 'workspaces/work');
    expect(readlinkSync(join(ws, 'settings.json'))).toBe(join(tmp, '.claude/settings.json'));
  });

  it('farmCreate replaces an existing real directory at the target', () => {
    const ws = join(process.env.CCWS_ROOT!, 'workspaces/work');
    mkdirSync(join(ws, 'plugins'), { recursive: true });
    writeFileSync(join(ws, 'plugins/junk.txt'), 'old');
    farmCreate('work');
    expect(lstatSync(join(ws, 'plugins')).isSymbolicLink()).toBe(true);
  });

  it('farmCreate merges an existing real projects dir into the shared source before linking', () => {
    const ws = join(process.env.CCWS_ROOT!, 'workspaces/work');
    // Per-workspace history that predates sharing.
    mkdirSync(join(ws, 'projects/proj-a'), { recursive: true });
    writeFileSync(join(ws, 'projects/proj-a/session-1.jsonl'), 'kept');
    // A session already in the shared dir must win on collision.
    mkdirSync(join(tmp, '.claude/projects/proj-a'), { recursive: true });
    writeFileSync(join(tmp, '.claude/projects/proj-a/shared.jsonl'), 'shared');

    farmCreate('work');

    expect(lstatSync(join(ws, 'projects')).isSymbolicLink()).toBe(true);
    // Old workspace history was merged into the shared source, not discarded.
    expect(readFileSync(join(tmp, '.claude/projects/proj-a/session-1.jsonl'), 'utf8')).toBe('kept');
    expect(readFileSync(join(tmp, '.claude/projects/proj-a/shared.jsonl'), 'utf8')).toBe('shared');
    // And it resolves through the symlink.
    expect(existsSync(join(ws, 'projects/proj-a/session-1.jsonl'))).toBe(true);
  });

  it('farmCreate creates the shared projects source when it does not exist', () => {
    rmSync(join(tmp, '.claude/projects'), { recursive: true, force: true });
    farmCreate('work');
    const ws = join(process.env.CCWS_ROOT!, 'workspaces/work');
    expect(lstatSync(join(ws, 'projects')).isSymbolicLink()).toBe(true);
    expect(existsSync(join(tmp, '.claude/projects'))).toBe(true);
  });

  it('farmVerify returns true when all links resolve', () => {
    farmCreate('work');
    expect(farmVerify('work').ok).toBe(true);
  });

  it('farmVerify reports broken links', () => {
    farmCreate('work');
    rmSync(join(tmp, '.claude/settings.json'));
    const r = farmVerify('work');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.broken.some((p) => p.endsWith('/settings.json'))).toBe(true);
    }
  });

  it('farmSync drops broken links and re-creates new ones', () => {
    farmCreate('work');
    rmSync(join(tmp, '.claude/settings.json'));
    writeFileSync(join(tmp, '.claude/CLAUDE.md'), '# hi');
    farmSync('work');
    const ws = join(process.env.CCWS_ROOT!, 'workspaces/work');
    expect(existsSync(join(ws, 'settings.json'))).toBe(false);
    expect(lstatSync(join(ws, 'CLAUDE.md')).isSymbolicLink()).toBe(true);
  });
});
