import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInit } from '../../src/commands/init.js';
import { _setReader } from '../../src/prompt.js';

describe('runInit', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let errs: string[];
  let errSpy: { mockRestore: () => void };
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-init-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    process.env.CCWS_REAL_CLAUDE_DIR = join(tmp, '.claude');
    errs = [];
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { errSpy.mockRestore(); _setReader(null); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('exit 2 on unknown flag', async () => {
    expect(await runInit(['--what'])).toBe(2);
  });

  it('--help returns 0', async () => {
    expect(await runInit(['--help'])).toBe(0);
  });

  it('idempotent: if workspaces dir is non-empty, print status and exit 0', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/existing'), { recursive: true });
    expect(await runInit([])).toBe(0);
    expect(errs.join('')).toMatch(/already initialized/);
  });

  it('happy path with existing ~/.claude and skipped first workspace', async () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    _setReader(async () => '\n');
    expect(await runInit([])).toBe(0);
    expect(existsSync(join(tmp, '.ccws/workspaces'))).toBe(true);
    expect(existsSync(join(tmp, '.claude/commands/whoami.md'))).toBe(true);
    expect(existsSync(join(tmp, '.claude/commands/switch.md'))).toBe(true);
    const defEnv = join(tmp, '.ccws/workspaces/default/ccws.env');
    expect(existsSync(defEnv)).toBe(true);
    expect(readFileSync(defEnv, 'utf8')).toMatch(/^CCWS_NO_ISOLATE=1$/m);
  });

  it('default workspace is force-created with noIsolate and blank prompts', async () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    _setReader(async () => '\n');
    expect(await runInit([])).toBe(0);
    const defEnv = readFileSync(join(tmp, '.ccws/workspaces/default/ccws.env'), 'utf8');
    expect(defEnv).toMatch(/^CCWS_NAME=default$/m);
    expect(defEnv).toMatch(/^CCWS_NO_ISOLATE=1$/m);
    expect(defEnv).not.toMatch(/ANTHROPIC_BASE_URL=/);
    expect(defEnv).not.toMatch(/ANTHROPIC_AUTH_TOKEN=/);
    expect(defEnv).not.toMatch(/HTTPS_PROXY=/);
  });

  it('default step is skipped (noop) when default already exists', async () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    mkdirSync(join(tmp, '.ccws/workspaces/default'), { recursive: true });
    const preExisting = 'CCWS_NAME=default\nCCWS_MANUAL=1\n';
    writeFileSync(join(tmp, '.ccws/workspaces/default/ccws.env'), preExisting);
    // workspaces dir is non-empty → init hits the "already initialized" branch
    // and exits before any prompts. Verify it does NOT clobber the env file.
    expect(await runInit([])).toBe(0);
    expect(readFileSync(join(tmp, '.ccws/workspaces/default/ccws.env'), 'utf8')).toBe(preExisting);
  });

  it('cancels when user declines to bootstrap missing ~/.claude', async () => {
    _setReader(async () => 'n\n');
    expect(await runInit([])).toBe(0);
    expect(errs.join('')).toMatch(/cancelled\. Run 'claude' once/);
    expect(existsSync(join(tmp, '.claude'))).toBe(false);
  });

  it('bootstraps ~/.claude when user says yes', async () => {
    const replies = ['y\n', '\n'];
    let i = 0;
    _setReader(async () => replies[i++] ?? null);
    expect(await runInit([])).toBe(0);
    expect(existsSync(join(tmp, '.claude/commands'))).toBe(true);
    expect(existsSync(join(tmp, '.claude/plugins'))).toBe(true);
    expect(readFileSync(join(tmp, '.claude/settings.json'), 'utf8')).toBe('{}');
  });

  it('--reset cancels when user answers no', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/x'), { recursive: true });
    _setReader(async () => 'n\n');
    expect(await runInit(['--reset'])).toBe(1);
    expect(existsSync(join(tmp, '.ccws'))).toBe(true);
  });

  it('--reset wipes ~/.ccws when user confirms', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/x'), { recursive: true });
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    const replies = ['y\n', '\n'];
    let i = 0;
    _setReader(async () => replies[i++] ?? null);
    expect(await runInit(['--reset'])).toBe(0);
    expect(existsSync(join(tmp, '.ccws/workspaces/x'))).toBe(false);
  });
});
