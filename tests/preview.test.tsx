import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Preview } from '../src/picker/Preview.js';
import type { Workspace } from '../src/workspace.js';

function makeWs(env: Record<string, string>): Workspace {
  return {
    name: 'w',
    endpoint: env.ANTHROPIC_BASE_URL ?? 'anthropic',
    proxy: false,
    dangerous: false,
    noIsolate: false,
    active: false,
    envPath: '/tmp/w/ccws.env',
    env,
    mtime: 0,
  };
}

describe('Preview', () => {
  it('renders every ccws.env key verbatim with original case', () => {
    const ws = makeWs({
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4',
      CLAUDE_CODE_ATTRIBUTION_HEADER: '0',
    });
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('ANTHROPIC_BASE_URL');
    expect(frame).toContain('https://api.anthropic.com');
    expect(frame).toContain('ANTHROPIC_DEFAULT_OPUS_MODEL');
    expect(frame).toContain('claude-opus-4');
    expect(frame).toContain('CLAUDE_CODE_ATTRIBUTION_HEADER');
    // value 0 follows the padded label
    expect(frame).toMatch(/CLAUDE_CODE_ATTRIBUTION_HEADER\s+0/);
  });

  it('rows are sorted alphabetically by key', () => {
    const ws = makeWs({
      Z_LAST: 'z',
      A_FIRST: 'a',
      M_MID: 'm',
    });
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    const a = frame.indexOf('A_FIRST');
    const m = frame.indexOf('M_MID');
    const z = frame.indexOf('Z_LAST');
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(m);
    expect(m).toBeLessThan(z);
  });

  it('masks values for keys ending in _TOKEN, _AUTH, _AUTH_TOKEN, _KEY (any case)', () => {
    const ws = makeWs({
      ANTHROPIC_AUTH_TOKEN: 'sk-secret',
      OPENAI_API_KEY: 'sk-anothersecret',
      my_auth: 'lowsec',
    });
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('ANTHROPIC_AUTH_TOKEN');
    expect(frame).toContain('OPENAI_API_KEY');
    expect(frame).toContain('my_auth');
    expect(frame).not.toContain('sk-secret');
    expect(frame).not.toContain('sk-anothersecret');
    expect(frame).not.toContain('lowsec');
    // Three '***' rows
    expect(frame.match(/\*\*\*/g)?.length ?? 0).toBe(3);
  });

  it('hides internal workspace keys (CCWS_NAME, CCWS_DANGEROUS)', () => {
    const ws = makeWs({
      CCWS_NAME: 'work',
      CCWS_DANGEROUS: '1',
      CCWS_DESCRIPTION: 'team',
      MY_FLAG: 'on',
    });
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    // CCWS_NAME / CCWS_DANGEROUS must not appear as env rows. (CLAUDE_CONFIG_DIR
    // legitimately appears as the derived-state header — see other tests.)
    expect(frame).not.toMatch(/^CCWS_NAME/m);
    expect(frame).not.toMatch(/^CCWS_DANGEROUS/m);
    // CCWS_DESCRIPTION is user-visible metadata — show it.
    expect(frame).toContain('CCWS_DESCRIPTION');
    expect(frame).toContain('team');
    expect(frame).toContain('MY_FLAG');
  });

  it('renders (ccws.env empty or malformed) warning when env yields zero rows, but still shows CLAUDE_CONFIG_DIR', () => {
    const ws = makeWs({ CCWS_NAME: 'w', CCWS_DANGEROUS: '1' });
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('(ccws.env empty or malformed)');
    expect(frame).toContain('CLAUDE_CONFIG_DIR');
  });

  it('label column width adapts to the longest key', () => {
    const ws = makeWs({
      A: '1',
      VERY_LONG_KEY_NAME_THAT_IS_LONG: '2',
    });
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    // All rows aligned: value column starts at the same x position.
    const lines = frame.split('\n').filter((l) => l.includes('1') || l.includes('2'));
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const oneIdx = lines.find((l) => l.includes(' 1'))!.indexOf(' 1');
    const twoIdx = lines.find((l) => l.includes(' 2'))!.indexOf(' 2');
    expect(oneIdx).toBe(twoIdx);
  });

  it('shows CLAUDE_CONFIG_DIR at the top with the derived workspace path', () => {
    const ws = makeWs({ ANTHROPIC_BASE_URL: 'https://api.x' });
    ws.envPath = '/Users/me/.ccws/workspaces/myws/ccws.env';
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    // CLAUDE_CONFIG_DIR is the first row (above any env entry).
    const ccdIdx = frame.indexOf('CLAUDE_CONFIG_DIR');
    const epIdx = frame.indexOf('ANTHROPIC_BASE_URL');
    expect(ccdIdx).toBeGreaterThanOrEqual(0);
    expect(ccdIdx).toBeLessThan(epIdx);
    expect(frame).toContain('myws');
  });

  it('home (no-isolate) workspace shows ~/.claude as the config dir', () => {
    const ws = makeWs({ ANTHROPIC_BASE_URL: 'https://api.x' });
    ws.noIsolate = true;
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('CLAUDE_CONFIG_DIR');
    expect(frame).toContain('~/.claude');
    // Plain path, no extra tagging — the row's '· home' marker already
    // signals the workspace is the home/no-isolate one.
    expect(frame).not.toContain('shared');
    expect(frame).not.toContain('no isolation');
  });

  it('tilde-shortens long ws paths under $HOME', () => {
    const origHome = process.env.HOME;
    process.env.HOME = '/Users/me';
    const ws = makeWs({ ANTHROPIC_BASE_URL: 'https://api.x' });
    ws.envPath = '/Users/me/.ccws/workspaces/foo/ccws.env';
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('~/.ccws/workspaces/foo');
    expect(frame).not.toContain('/Users/me/.ccws');
    process.env.HOME = origHome;
  });

  it('mid-ellipsizes very long paths', () => {
    const ws = makeWs({ ANTHROPIC_BASE_URL: 'https://api.x' });
    ws.envPath = '/super/long/path/x'.repeat(8) + '/myws/ccws.env';
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('…');
    // Suffix still includes the workspace name (so user can read it).
    expect(frame).toContain('myws');
  });
});
