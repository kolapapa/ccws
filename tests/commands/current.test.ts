import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runCurrent } from '../../src/commands/current.js';

describe('runCurrent', () => {
  const origEnv = { ...process.env };
  let stdoutWrites: string[];
  let outSpy: { mockRestore: () => void };
  beforeEach(() => {
    process.env = { ...origEnv };
    stdoutWrites = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { stdoutWrites.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); process.env = origEnv; });
  function out(): string { return stdoutWrites.join(''); }

  it('plain: prints (none) hint when CCWS_NAME unset, exit 0', async () => {
    delete process.env.CCWS_NAME;
    expect(await runCurrent([])).toBe(0);
    expect(out()).toBe('(none) — run "ccws use <name>" to activate\n');
  });

  it('--path: returns 1 and emits nothing when CCWS_NAME unset', async () => {
    delete process.env.CCWS_NAME;
    expect(await runCurrent(['--path'])).toBe(1);
    expect(out()).toBe('');
  });

  it('plain: prints <name> (CLAUDE_CONFIG_DIR=<path>)', async () => {
    process.env.HOME = '/h';
    process.env.CCWS_ROOT = '/h/.ccws';
    process.env.CCWS_NAME = 'work';
    process.env.CLAUDE_CONFIG_DIR = '/h/.ccws/workspaces/work';
    expect(await runCurrent([])).toBe(0);
    expect(out()).toBe('work (CLAUDE_CONFIG_DIR=/h/.ccws/workspaces/work)\n');
  });

  it('--path: prints workspace dir path', async () => {
    process.env.CCWS_ROOT = '/h/.ccws';
    process.env.CCWS_NAME = 'work';
    expect(await runCurrent(['--path'])).toBe(0);
    expect(out()).toBe('/h/.ccws/workspaces/work\n');
  });

  it('-p shorthand same as --path', async () => {
    process.env.CCWS_ROOT = '/h/.ccws';
    process.env.CCWS_NAME = 'work';
    expect(await runCurrent(['-p'])).toBe(0);
    expect(out()).toBe('/h/.ccws/workspaces/work\n');
  });
});
