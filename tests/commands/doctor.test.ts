import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runDoctor } from '../../src/commands/doctor.js';

function stripAnsi(s: string): string { return s.replace(/\x1b\[[0-9;]*m/g, ''); }

describe('runDoctor', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let outs: string[];
  let outSpy: { mockRestore: () => void };
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-doctor-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    process.env.CCWS_REAL_CLAUDE_DIR = join(tmp, '.claude');
    process.env.PATH = '/usr/bin:/bin';
    delete process.env.CLAUDE_CONFIG_DIR;
    delete process.env.CCWS_NAME;
    outs = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { outs.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  function out(): string { return stripAnsi(outs.join('')); }

  it('summary line always present, exit 0 with zero errors', async () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    mkdirSync(join(tmp, '.ccws/workspaces/alpha'), { recursive: true });
    writeFileSync(join(tmp, '.ccws/workspaces/alpha/ccws.env'), 'CCWS_NAME=alpha\n');
    mkdirSync(join(tmp, 'bin'), { recursive: true });
    writeFileSync(join(tmp, 'bin/claude'), '#!/bin/sh\n');
    process.env.PATH = `${join(tmp, 'bin')}:${process.env.PATH}`;
    const code = await runDoctor([]);
    expect(out()).toMatch(/summary: \d+ warning\(s\), \d+ error\(s\)/);
    expect(code).toBe(0);
  });

  it('warns when ~/.claude is missing', async () => {
    mkdirSync(join(tmp, '.ccws'), { recursive: true });
    await runDoctor([]);
    expect(out()).toMatch(/! ~\/\.claude\/ missing/);
  });

  it('errors when ccws.env is missing for a workspace', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/x'), { recursive: true });
    const code = await runDoctor([]);
    expect(out()).toMatch(/✗ workspace 'x' missing ccws\.env/);
    expect(code).toBe(1);
  });

  it('warns on broken symlinks in a workspace', async () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    mkdirSync(join(tmp, '.ccws/workspaces/alpha'), { recursive: true });
    writeFileSync(join(tmp, '.ccws/workspaces/alpha/ccws.env'), 'CCWS_NAME=alpha\n');
    symlinkSync(join(tmp, '.claude/missing.json'), join(tmp, '.ccws/workspaces/alpha/settings.json'));
    await runDoctor([]);
    expect(out()).toMatch(/! workspace 'alpha' has broken symlinks/);
  });

  it('warns when CLAUDE_CONFIG_DIR is set outside ccws', async () => {
    process.env.CLAUDE_CONFIG_DIR = '/tmp/elsewhere';
    delete process.env.CCWS_NAME;
    await runDoctor([]);
    expect(out()).toMatch(/! CLAUDE_CONFIG_DIR set outside ccws/);
  });

  it('errors when claude binary is missing from PATH', async () => {
    process.env.PATH = '/no/such/path';
    const code = await runDoctor([]);
    expect(out()).toMatch(/✗ claude binary not on PATH/);
    expect(code).toBe(1);
  });
});
