import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runSwitch } from '../src/commands/switch.js';
import { nextWorkspaceFile } from '../src/paths.js';

describe('ccws switch', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let out: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-switch-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    delete process.env.CCWS_NAME;
    mkdirSync(join(tmp, '.ccws/workspaces/deepseek'), { recursive: true });
    mkdirSync(join(tmp, '.ccws/workspaces/gradient'), { recursive: true });
    out = '';
    vi.spyOn(process.stdout, 'write').mockImplementation((s: string | Uint8Array) => {
      out += s.toString();
      return true;
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tmp, { recursive: true, force: true });
    process.env = origEnv;
  });

  it('arms a switch by writing the marker with name and session id', async () => {
    const code = await runSwitch(['deepseek', '439c89b1-7ccc-4039-8a2a-88ad92b50612']);
    expect(code).toBe(0);
    const marker = readFileSync(nextWorkspaceFile(), 'utf8');
    expect(marker).toBe('deepseek\n439c89b1-7ccc-4039-8a2a-88ad92b50612\n');
  });

  it('arms a switch with no session id (continue fallback)', async () => {
    const code = await runSwitch(['deepseek']);
    expect(code).toBe(0);
    expect(readFileSync(nextWorkspaceFile(), 'utf8')).toBe('deepseek\n\n');
  });

  it('rejects an unknown workspace and writes no marker', async () => {
    const code = await runSwitch(['ghost']);
    expect(code).toBe(1);
    expect(existsSync(nextWorkspaceFile())).toBe(false);
  });

  it('rejects switching to the already-active workspace', async () => {
    process.env.CCWS_NAME = 'deepseek';
    const code = await runSwitch(['deepseek', 'sid']);
    expect(code).toBe(1);
    expect(existsSync(nextWorkspaceFile())).toBe(false);
  });

  it('rejects an invalid name', async () => {
    const code = await runSwitch(['bad name']);
    expect(code).toBe(2);
    expect(existsSync(nextWorkspaceFile())).toBe(false);
  });

  it('errors when armed with no name', async () => {
    const code = await runSwitch([]);
    expect(code).toBe(2);
    expect(existsSync(nextWorkspaceFile())).toBe(false);
  });

  it('--pop prints "name sessionid" and deletes the marker', async () => {
    writeFileSync(nextWorkspaceFile(), 'deepseek\n439c89b1\n');
    const code = await runSwitch(['--pop']);
    expect(code).toBe(0);
    expect(out).toBe('deepseek 439c89b1\n');
    expect(existsSync(nextWorkspaceFile())).toBe(false);
  });

  it('--pop prints just the name when no session id was stored', async () => {
    writeFileSync(nextWorkspaceFile(), 'deepseek\n\n');
    const code = await runSwitch(['--pop']);
    expect(code).toBe(0);
    expect(out).toBe('deepseek\n');
    expect(existsSync(nextWorkspaceFile())).toBe(false);
  });

  it('--pop prints nothing and succeeds when there is no marker', async () => {
    const code = await runSwitch(['--pop']);
    expect(code).toBe(0);
    expect(out).toBe('');
  });
});
