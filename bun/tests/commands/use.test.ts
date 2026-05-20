import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runUse } from '../../src/commands/use.js';

describe('runUse', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let stdoutWrites: string[];
  let stderrWrites: string[];
  let outSpy: { mockRestore: () => void };
  let errSpy: { mockRestore: () => void };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-use-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    mkdirSync(join(tmp, '.ccws/workspaces/work'), { recursive: true });
    stdoutWrites = []; stderrWrites = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { stdoutWrites.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { stderrWrites.push(String(c)); return true; });
  });
  afterEach(() => {
    outSpy.mockRestore(); errSpy.mockRestore();
    rmSync(tmp, { recursive: true, force: true });
    process.env = origEnv;
  });

  function out(): string { return stdoutWrites.join(''); }

  it('exits 2 with bad name', async () => {
    expect(await runUse(['has space'])).toBe(2);
  });

  it('exits 1 when workspace dir missing', async () => {
    expect(await runUse(['nonexistent'])).toBe(1);
    expect(stderrWrites.join('')).toContain('workspace not found');
  });

  it('always exports CCWS_NAME, CCWS_REAL_HOME, CLAUDE_CONFIG_DIR', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'), 'CCWS_NAME=work\nCCWS_CREATED=2026-01-01T00:00:00Z\n');
    process.env.HOME = '/home/me';
    expect(await runUse(['work'])).toBe(0);
    const lines = out().split('\n');
    expect(lines).toContain(`export CCWS_NAME='work'`);
    expect(lines).toContain(`export CCWS_REAL_HOME='/home/me'`);
    expect(lines).toContain(`export CLAUDE_CONFIG_DIR='${join(tmp, '.ccws/workspaces/work')}'`);
  });

  it('CCWS_NO_ISOLATE=1: skips CLAUDE_CONFIG_DIR + CCWS_REAL_HOME, keeps CCWS_NAME and other env', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nCCWS_NO_ISOLATE=1\nANTHROPIC_BASE_URL=https://api.x\nANTHROPIC_AUTH_TOKEN=sk-1\n');
    expect(await runUse(['work'])).toBe(0);
    const lines = out().split('\n');
    expect(lines).toContain(`export CCWS_NAME='work'`);
    // No CLAUDE_CONFIG_DIR / CCWS_REAL_HOME — claude/plugins fall back to ~/.claude
    expect(out()).not.toContain('CLAUDE_CONFIG_DIR');
    expect(out()).not.toContain('CCWS_REAL_HOME');
    // But the workspace's API config still ships
    expect(lines).toContain(`export ANTHROPIC_BASE_URL='https://api.x'`);
    expect(lines).toContain(`export ANTHROPIC_AUTH_TOKEN='sk-1'`);
    // CCWS_NO_ISOLATE itself is internal — must not leak
    expect(out()).not.toContain('CCWS_NO_ISOLATE');
    // Tracking var reflects what was actually exported
    const last = lines.find((l) => l.startsWith('export CCWS_EXPORTED='));
    expect(last).toBeDefined();
    expect(last).toContain('CCWS_NAME');
    expect(last).toContain('ANTHROPIC_BASE_URL');
    expect(last).toContain('ANTHROPIC_AUTH_TOKEN');
    expect(last).not.toContain('CLAUDE_CONFIG_DIR');
    expect(last).not.toContain('CCWS_REAL_HOME');
  });

  it('CCWS_NO_ISOLATE without =1 is ignored (any other value still triggers isolation)', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nCCWS_NO_ISOLATE=0\n');
    expect(await runUse(['work'])).toBe(0);
    expect(out()).toContain('CLAUDE_CONFIG_DIR');
  });

  it('exports ANTHROPIC_* and CLAUDE_* keys verbatim', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nANTHROPIC_BASE_URL=https://api.anthropic.com\nANTHROPIC_AUTH_TOKEN=sk-123\nCLAUDE_CODE_EFFORT_LEVEL=high\n');
    expect(await runUse(['work'])).toBe(0);
    expect(out()).toContain(`export ANTHROPIC_BASE_URL='https://api.anthropic.com'`);
    expect(out()).toContain(`export ANTHROPIC_AUTH_TOKEN='sk-123'`);
    expect(out()).toContain(`export CLAUDE_CODE_EFFORT_LEVEL='high'`);
  });

  it('skips internal metadata keys CCWS_NAME / CCWS_CREATED / CCWS_DESCRIPTION', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nCCWS_CREATED=2026-01-01T00:00:00Z\nCCWS_DESCRIPTION=team workspace\n');
    expect(await runUse(['work'])).toBe(0);
    const matches = out().match(/export CCWS_NAME=/g) ?? [];
    expect(matches.length).toBe(1);
    expect(out()).not.toContain(`export CCWS_CREATED=`);
    expect(out()).not.toContain(`export CCWS_DESCRIPTION=`);
  });

  it('exports CCWS_BINARY and prepends its dirname to PATH', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nCCWS_BINARY=/opt/claude/bin/claude\n');
    process.env.PATH = '/usr/bin';
    expect(await runUse(['work'])).toBe(0);
    expect(out()).toContain(`export CCWS_BINARY='/opt/claude/bin/claude'`);
    expect(out()).toContain(`export PATH='/opt/claude/bin:/usr/bin'`);
  });

  it('exports both upper and lower case proxy vars', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nHTTPS_PROXY=http://p:7890\nhttps_proxy=http://p:7890\nHTTP_PROXY=http://p:7890\nhttp_proxy=http://p:7890\n');
    expect(await runUse(['work'])).toBe(0);
    expect(out()).toContain(`export HTTPS_PROXY=`);
    expect(out()).toContain(`export https_proxy=`);
    expect(out()).toContain(`export HTTP_PROXY=`);
    expect(out()).toContain(`export http_proxy=`);
  });

  it('exports arbitrary user-defined keys verbatim (no allowlist)', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nRANDOM_KEY=ok\nFOO_BAR=yes\nclaude_code_attribution_header=0\n');
    expect(await runUse(['work'])).toBe(0);
    expect(out()).toContain(`export RANDOM_KEY='ok'`);
    expect(out()).toContain(`export FOO_BAR='yes'`);
    expect(out()).toContain(`export claude_code_attribution_header='0'`);
  });

  it('emits CCWS_EXPORTED as a comma-separated list (unquoted) as the last export', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nANTHROPIC_BASE_URL=https://x\n');
    expect(await runUse(['work'])).toBe(0);
    const lines = out().trimEnd().split('\n');
    const last = lines[lines.length - 1]!;
    expect(last).toMatch(/^export CCWS_EXPORTED=[A-Z_,]+$/);
    expect(last).toContain('CCWS_NAME');
    expect(last).toContain('CCWS_REAL_HOME');
    expect(last).toContain('CLAUDE_CONFIG_DIR');
    expect(last).toContain('ANTHROPIC_BASE_URL');
    expect(last).not.toContain(`'`);
  });

  it('stdout output is eval-able by bash and sets the expected vars', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      "CCWS_NAME=work\nANTHROPIC_AUTH_TOKEN=sk's-tricky\n");
    expect(await runUse(['work'])).toBe(0);
    const captured = out();
    const proc = Bun.spawn({
      cmd: ['bash', '-c', `${captured}\nprintf '%s\\n' "$CCWS_NAME" "$ANTHROPIC_AUTH_TOKEN"`],
      stdout: 'pipe',
    });
    const text = await new Response(proc.stdout).text();
    expect(text).toBe(`work\nsk's-tricky\n`);
  });
});
