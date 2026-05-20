import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runAdd } from '../../src/commands/add.js';
import { _setReader } from '../../src/prompt.js';

describe('runAdd', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let errs: string[];
  let errSpy: { mockRestore: () => void };
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-add-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    process.env.CCWS_REAL_CLAUDE_DIR = join(tmp, '.claude');
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    writeFileSync(join(tmp, '.claude/settings.json'), '{}');
    errs = [];
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { errSpy.mockRestore(); _setReader(null); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('exit 2 on bad name', async () => {
    expect(await runAdd(['has space', '--non-interactive'])).toBe(2);
  });

  it('exit 1 if workspace already exists', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/work'), { recursive: true });
    expect(await runAdd(['work', '--non-interactive'])).toBe(1);
    expect(errs.join('')).toMatch(/already exists/);
  });

  it('non-interactive flow: writes ccws.env with provided flags only', async () => {
    expect(await runAdd(['work', '--base-url', 'https://api.x', '--token', 'sk-1', '--non-interactive'])).toBe(0);
    const env = readFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'), 'utf8');
    expect(env).toMatch(/^CCWS_NAME=work$/m);
    expect(env).toMatch(/^ANTHROPIC_BASE_URL=https:\/\/api\.x$/m);
    expect(env).toMatch(/^ANTHROPIC_AUTH_TOKEN=sk-1$/m);
    expect(env).not.toMatch(/CCWS_DESCRIPTION/);
    expect(env).not.toMatch(/HTTPS_PROXY/);
  });

  it('creates symlink farm', async () => {
    expect(await runAdd(['work', '--non-interactive'])).toBe(0);
    expect(lstatSync(join(tmp, '.ccws/workspaces/work/settings.json')).isSymbolicLink()).toBe(true);
  });

  it('proxy flag writes both HTTPS_PROXY and HTTP_PROXY', async () => {
    expect(await runAdd(['work', '--proxy', 'http://p:7890', '--non-interactive'])).toBe(0);
    const env = readFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'), 'utf8');
    expect(env).toMatch(/^HTTPS_PROXY=http:\/\/p:7890$/m);
    expect(env).toMatch(/^HTTP_PROXY=http:\/\/p:7890$/m);
  });

  it('interactive flow: prompts for name when none given', async () => {
    const replies = ['work\n', '\n', '\n', '\n', 'n\n'];
    let idx = 0;
    _setReader(async () => replies[idx++] ?? null);
    expect(await runAdd([])).toBe(0);
    expect(existsSync(join(tmp, '.ccws/workspaces/work/ccws.env'))).toBe(true);
  });

  it('interactive proxy y: prompts again for URL', async () => {
    const replies = ['p\n', '\n', '\n', '\n', 'y\n', '\n'];
    let idx = 0;
    _setReader(async () => replies[idx++] ?? null);
    expect(await runAdd([])).toBe(0);
    const env = readFileSync(join(tmp, '.ccws/workspaces/p/ccws.env'), 'utf8');
    expect(env).toMatch(/HTTPS_PROXY=http:\/\/127\.0\.0\.1:7890/);
  });

  it('soft-warns when ~/.claude is missing', async () => {
    rmSync(join(tmp, '.claude'), { recursive: true, force: true });
    expect(await runAdd(['work', '--non-interactive'])).toBe(0);
    expect(errs.join('')).toMatch(/warn:.*\.claude\/ does not exist/);
  });
});
