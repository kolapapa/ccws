import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runList } from '../../src/commands/list.js';

describe('runList', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let stdoutWrites: string[];
  let stderrWrites: string[];
  let outSpy: { mockRestore: () => void };
  let errSpy: { mockRestore: () => void };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-list-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    delete process.env.CCWS_NAME;
    stdoutWrites = []; stderrWrites = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { stdoutWrites.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { stderrWrites.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); errSpy.mockRestore(); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('prints info to stderr and exits 0 when workspaces dir missing', async () => {
    expect(await runList([])).toBe(0);
    expect(stderrWrites.join('')).toContain("no workspaces yet — run 'ccws add <name>'");
  });

  it('plain mode prints " <name>" per workspace', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/alpha'), { recursive: true });
    mkdirSync(join(tmp, '.ccws/workspaces/beta'), { recursive: true });
    expect(await runList([])).toBe(0);
    expect(stdoutWrites.join('').split('\n').filter(Boolean).sort()).toEqual([' alpha', ' beta']);
  });

  it('marks active workspace with *', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/alpha'), { recursive: true });
    mkdirSync(join(tmp, '.ccws/workspaces/beta'), { recursive: true });
    process.env.CCWS_NAME = 'beta';
    expect(await runList([])).toBe(0);
    const lines = stdoutWrites.join('').split('\n').filter(Boolean).sort();
    expect(lines).toEqual([' alpha', '* beta']);
  });

  it('verbose mode prints endpoint + created columns', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/alpha'), { recursive: true });
    writeFileSync(join(tmp, '.ccws/workspaces/alpha/ccws.env'),
      'CCWS_NAME=alpha\nCCWS_CREATED=2026-01-01T00:00:00Z\nANTHROPIC_BASE_URL=https://x\n');
    expect(await runList(['--verbose'])).toBe(0);
    expect(stdoutWrites.join('')).toContain(' alpha  endpoint=https://x  created=2026-01-01T00:00:00Z');
  });

  it('verbose mode defaults endpoint to "anthropic" and created to "?" when missing', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/alpha'), { recursive: true });
    writeFileSync(join(tmp, '.ccws/workspaces/alpha/ccws.env'), 'CCWS_NAME=alpha\n');
    expect(await runList(['-v'])).toBe(0);
    expect(stdoutWrites.join('')).toContain(' alpha  endpoint=anthropic  created=?');
  });
});
