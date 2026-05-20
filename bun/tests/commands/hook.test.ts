import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runHook } from '../../src/commands/hook.js';

describe('runHook', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let outs: string[]; let errs: string[];
  let outSpy: { mockRestore: () => void };
  let errSpy: { mockRestore: () => void };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-hook-'));
    process.env = { ...origEnv };
    process.env.CCWS_DIR = tmp;
    mkdirSync(join(tmp, 'share'), { recursive: true });
    writeFileSync(join(tmp, 'share/init.sh'), '');
    writeFileSync(join(tmp, 'share/init.fish'), '');
    writeFileSync(join(tmp, 'share/claude-wrapper.sh'), '');
    outs = []; errs = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { outs.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); errSpy.mockRestore(); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('returns 2 + usage when no args', async () => {
    expect(await runHook([])).toBe(2);
    expect(errs.join('')).toMatch(/Usage:/);
  });

  it('--help returns 0 and prints usage', async () => {
    expect(await runHook(['--help'])).toBe(0);
    expect(errs.join('')).toMatch(/Usage:/);
  });

  it('--shell zsh emits source <quoted path>/share/init.sh', async () => {
    expect(await runHook(['--shell', 'zsh'])).toBe(0);
    expect(outs.join('').trim()).toBe(`source '${join(tmp, 'share/init.sh')}'`);
  });

  it('--shell bash emits the same init.sh source', async () => {
    expect(await runHook(['--shell', 'bash'])).toBe(0);
    expect(outs.join('').trim()).toBe(`source '${join(tmp, 'share/init.sh')}'`);
  });

  it('--shell fish emits source <plain path>/share/init.fish', async () => {
    expect(await runHook(['--shell', 'fish'])).toBe(0);
    expect(outs.join('').trim()).toBe(`source ${join(tmp, 'share/init.fish')}`);
  });

  it('--shell zsh --claude appends the wrapper source line', async () => {
    expect(await runHook(['--shell', 'zsh', '--claude'])).toBe(0);
    const lines = outs.join('').trim().split('\n');
    expect(lines).toEqual([
      `source '${join(tmp, 'share/init.sh')}'`,
      `source '${join(tmp, 'share/claude-wrapper.sh')}'`,
    ]);
  });

  it('exits 2 on unknown shell', async () => {
    expect(await runHook(['--shell', 'tcsh'])).toBe(2);
    expect(errs.join('')).toMatch(/unsupported shell/);
  });

  it('exits 1 when share/init.sh is missing', async () => {
    rmSync(join(tmp, 'share/init.sh'));
    expect(await runHook(['--shell', 'zsh'])).toBe(1);
    expect(errs.join('')).toMatch(/init\.sh not found/);
  });
});
