import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runHook } from '../../src/commands/hook.js';
import { CLAUDE_WRAPPER, INIT_FISH, INIT_SH } from '../../src/embedded.js';

describe('runHook', () => {
  let outs: string[]; let errs: string[];
  let outSpy: { mockRestore: () => void };
  let errSpy: { mockRestore: () => void };

  beforeEach(() => {
    outs = []; errs = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { outs.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); errSpy.mockRestore(); });

  it('returns 2 + usage when no args', async () => {
    expect(await runHook([])).toBe(2);
    expect(errs.join('')).toMatch(/Usage:/);
  });

  it('--help returns 0 and prints usage', async () => {
    expect(await runHook(['--help'])).toBe(0);
    expect(errs.join('')).toMatch(/Usage:/);
  });

  it('--shell zsh emits the embedded bash init script', async () => {
    expect(await runHook(['--shell', 'zsh'])).toBe(0);
    expect(outs.join('')).toBe(INIT_SH);
  });

  it('--shell bash emits the same init script', async () => {
    expect(await runHook(['--shell', 'bash'])).toBe(0);
    expect(outs.join('')).toBe(INIT_SH);
  });

  it('--shell fish emits the embedded fish init script', async () => {
    expect(await runHook(['--shell', 'fish'])).toBe(0);
    expect(outs.join('')).toBe(INIT_FISH);
  });

  it('--shell zsh --claude appends the claude wrapper', async () => {
    expect(await runHook(['--shell', 'zsh', '--claude'])).toBe(0);
    expect(outs.join('')).toBe(INIT_SH + CLAUDE_WRAPPER);
  });

  it('--claude alone emits just the claude wrapper', async () => {
    expect(await runHook(['--claude'])).toBe(0);
    expect(outs.join('')).toBe(CLAUDE_WRAPPER);
  });

  it('exits 2 on unknown shell', async () => {
    expect(await runHook(['--shell', 'tcsh'])).toBe(2);
    expect(errs.join('')).toMatch(/unsupported shell/);
  });

  it('exits 2 on unknown flag', async () => {
    expect(await runHook(['--wat'])).toBe(2);
    expect(errs.join('')).toMatch(/unknown flag/);
  });

  it('emitted content defines a ccws shell function (proves eval-ability)', async () => {
    await runHook(['--shell', 'zsh']);
    expect(outs.join('')).toMatch(/^ccws\(\) \{/);
  });
});
