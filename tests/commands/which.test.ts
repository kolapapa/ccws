import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runWhich } from '../../src/commands/which.js';

describe('runWhich', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let origCwd: string;
  let outs: string[]; let errs: string[];
  let outSpy: { mockRestore: () => void };
  let errSpy: { mockRestore: () => void };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-which-'));
    origCwd = process.cwd();
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    mkdirSync(process.env.CCWS_ROOT, { recursive: true });
    delete process.env.CCWS_NAME;
    outs = []; errs = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { outs.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); errSpy.mockRestore(); process.chdir(origCwd); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('shell scope wins and prints name on stdout', async () => {
    process.env.CCWS_NAME = 'shellws';
    expect(await runWhich([])).toBe(0);
    expect(outs.join('')).toBe('shellws\n');
  });

  it('exits 1 when nothing resolves', async () => {
    process.chdir(tmp);
    expect(await runWhich([])).toBe(1);
    expect(outs.join('')).toBe('');
  });

  it('--explain on a shell hit prints source: shell on stderr', async () => {
    process.env.CCWS_NAME = 'shellws';
    expect(await runWhich(['--explain'])).toBe(0);
    expect(errs.join('')).toContain('source: shell');
  });

  it('--explain on miss prints all three scope statuses on stderr', async () => {
    process.chdir(tmp);
    expect(await runWhich(['--explain'])).toBe(1);
    const e = errs.join('');
    expect(e).toContain('.ccws-workspace:');
    expect(e).toContain('global:');
    expect(e).toContain('CCWS_NAME:');
  });

  it('falls back to .ccws-workspace then global', async () => {
    mkdirSync(join(tmp, 'proj'), { recursive: true });
    writeFileSync(join(tmp, 'proj/.ccws-workspace'), 'localws\n');
    process.chdir(join(tmp, 'proj'));
    expect(await runWhich([])).toBe(0);
    expect(outs.join('')).toBe('localws\n');
  });
});
