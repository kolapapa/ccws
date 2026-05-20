import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runGlobal } from '../../src/commands/global.js';

describe('runGlobal', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let outs: string[]; let errs: string[];
  let outSpy: { mockRestore: () => void };
  let errSpy: { mockRestore: () => void };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-global-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    mkdirSync(join(tmp, '.ccws/workspaces/work'), { recursive: true });
    outs = []; errs = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { outs.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); errSpy.mockRestore(); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('no args + no file: error + exit 1', async () => {
    expect(await runGlobal([])).toBe(1);
    expect(errs.join('')).toMatch(/no global workspace set/);
  });

  it('positional name writes ~/.ccws/global', async () => {
    expect(await runGlobal(['work'])).toBe(0);
    expect(readFileSync(join(tmp, '.ccws/global'), 'utf8').trim()).toBe('work');
  });

  it('no args + file present: print name', async () => {
    writeFileSync(join(tmp, '.ccws/global'), 'work\n');
    expect(await runGlobal([])).toBe(0);
    expect(outs.join('')).toBe('work\n');
  });

  it('--unset removes file, idempotent', async () => {
    writeFileSync(join(tmp, '.ccws/global'), 'work\n');
    expect(await runGlobal(['--unset'])).toBe(0);
    expect(existsSync(join(tmp, '.ccws/global'))).toBe(false);
    outs.length = 0; errs.length = 0;
    expect(await runGlobal(['--unset'])).toBe(0);
    expect(errs.join('')).toMatch(/no global workspace set/);
  });

  it('positional pointing at missing workspace: exit 1', async () => {
    expect(await runGlobal(['nope'])).toBe(1);
  });

  it('bad name: exit 2', async () => {
    expect(await runGlobal(['has space'])).toBe(2);
  });
});
