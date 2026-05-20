import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runRm } from '../../src/commands/rm.js';
import { _setReader } from '../../src/prompt.js';

describe('runRm', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let errs: string[];
  let errSpy: { mockRestore: () => void };
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-rm-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    mkdirSync(join(tmp, '.ccws/workspaces/work'), { recursive: true });
    delete process.env.CCWS_NAME;
    errs = [];
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { errSpy.mockRestore(); _setReader(null); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('exit 2 on bad name', async () => {
    expect(await runRm(['has space'])).toBe(2);
  });

  it('exit 1 when workspace missing', async () => {
    expect(await runRm(['nope', '-f'])).toBe(1);
  });

  it('exit 1 when workspace is currently active in shell', async () => {
    process.env.CCWS_NAME = 'work';
    expect(await runRm(['work', '-f'])).toBe(1);
    expect(errs.join('')).toMatch(/currently active/);
  });

  it('--force skips confirmation and deletes', async () => {
    expect(await runRm(['work', '-f'])).toBe(0);
    expect(existsSync(join(tmp, '.ccws/workspaces/work'))).toBe(false);
    expect(errs.join('')).toMatch(/ok: removed workspace 'work'/);
  });

  it('prompts y/N: empty input cancels', async () => {
    _setReader(async () => '\n');
    expect(await runRm(['work'])).toBe(1);
    expect(existsSync(join(tmp, '.ccws/workspaces/work'))).toBe(true);
    expect(errs.join('')).toMatch(/cancelled/);
  });

  it('prompts y/N: y confirms and deletes', async () => {
    _setReader(async () => 'y\n');
    expect(await runRm(['work'])).toBe(0);
    expect(existsSync(join(tmp, '.ccws/workspaces/work'))).toBe(false);
  });
});
