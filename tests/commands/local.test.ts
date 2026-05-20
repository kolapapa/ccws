import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runLocal } from '../../src/commands/local.js';

describe('runLocal', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let origCwd: string;
  let outs: string[]; let errs: string[];
  let outSpy: { mockRestore: () => void };
  let errSpy: { mockRestore: () => void };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-local-'));
    origCwd = process.cwd();
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    mkdirSync(join(tmp, '.ccws/workspaces/work'), { recursive: true });
    process.chdir(tmp);
    outs = []; errs = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { outs.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); errSpy.mockRestore(); process.chdir(origCwd); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('no args + no file: error + exit 1', async () => {
    expect(await runLocal([])).toBe(1);
    expect(errs.join('')).toMatch(/no \.ccws-workspace in/);
  });

  it('no args + file present: print name on stdout, exit 0', async () => {
    writeFileSync(join(tmp, '.ccws-workspace'), 'work\n');
    expect(await runLocal([])).toBe(0);
    expect(outs.join('')).toBe('work\n');
  });

  it('--unset removes the file with an ok log, idempotent', async () => {
    writeFileSync(join(tmp, '.ccws-workspace'), 'work\n');
    expect(await runLocal(['--unset'])).toBe(0);
    expect(existsSync(join(tmp, '.ccws-workspace'))).toBe(false);
    expect(errs.join('')).toMatch(/ok: removed/);
    outs.length = 0; errs.length = 0;
    expect(await runLocal(['--unset'])).toBe(0);
    expect(errs.join('')).toMatch(/no \.ccws-workspace/);
  });

  it('positional name: writes file with name, exit 0', async () => {
    expect(await runLocal(['work'])).toBe(0);
    expect(readFileSync(join(tmp, '.ccws-workspace'), 'utf8').trim()).toBe('work');
    expect(errs.join('')).toMatch(/ok: set local workspace to 'work'/);
  });

  it('positional name with bad name: exit 2', async () => {
    expect(await runLocal(['has space'])).toBe(2);
  });

  it('positional name pointing at nonexistent workspace: exit 1', async () => {
    expect(await runLocal(['nope'])).toBe(1);
    expect(errs.join('')).toMatch(/workspace 'nope' does not exist/);
  });
});
