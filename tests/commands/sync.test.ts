import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, lstatSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runSync } from '../../src/commands/sync.js';

describe('runSync', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let errs: string[];
  let errSpy: { mockRestore: () => void };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-sync-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    process.env.CCWS_REAL_CLAUDE_DIR = join(tmp, '.claude');
    mkdirSync(join(tmp, '.claude/commands'), { recursive: true });
    writeFileSync(join(tmp, '.claude/settings.json'), '{}');
    mkdirSync(join(tmp, '.ccws/workspaces/alpha'), { recursive: true });
    mkdirSync(join(tmp, '.ccws/workspaces/beta'), { recursive: true });
    errs = [];
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { errSpy.mockRestore(); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('exit 2 on bad name', async () => {
    expect(await runSync(['has space'])).toBe(2);
  });

  it('named workspace missing: exit 1', async () => {
    expect(await runSync(['nope'])).toBe(1);
  });

  it('named workspace: links it and exits 0', async () => {
    expect(await runSync(['alpha'])).toBe(0);
    expect(lstatSync(join(tmp, '.ccws/workspaces/alpha/settings.json')).isSymbolicLink()).toBe(true);
    expect(errs.join('')).toMatch(/ok: synced workspace 'alpha'/);
  });

  it('no name: syncs all and reports count', async () => {
    expect(await runSync([])).toBe(0);
    expect(lstatSync(join(tmp, '.ccws/workspaces/alpha/settings.json')).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(tmp, '.ccws/workspaces/beta/settings.json')).isSymbolicLink()).toBe(true);
    expect(errs.join('')).toMatch(/ok: synced 2 workspace\(s\)/);
  });

  it('no workspaces yet: prints info, exit 0', async () => {
    rmSync(join(tmp, '.ccws/workspaces'), { recursive: true, force: true });
    expect(await runSync([])).toBe(0);
    expect(errs.join('')).toMatch(/no workspaces/);
  });
});
