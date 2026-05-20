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
    expect(frame).not.toMatch(/CCWS_NAME/);
    expect(frame).not.toMatch(/CCWS_DANGEROUS/);
    // CCWS_DESCRIPTION is user-visible metadata — show it.
    expect(frame).toContain('CCWS_DESCRIPTION');
    expect(frame).toContain('team');
    expect(frame).toContain('MY_FLAG');
  });

  it('renders (ccws.env empty or malformed) warning when env yields zero rows', () => {
    const ws = makeWs({ CCWS_NAME: 'w', CCWS_DANGEROUS: '1' });
    const { lastFrame } = render(<Preview workspace={ws} />);
    expect(lastFrame()).toContain('(ccws.env empty or malformed)');
  });

  it('label column width adapts to the longest key', () => {
    const ws = makeWs({
      A: '1',
      VERY_LONG_KEY_NAME_THAT_IS_LONG: '2',
    });
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    // Both rows are aligned: value column starts at the same x position.
    const lines = frame.split('\n').filter((l) => l.includes('1') || l.includes('2'));
    expect(lines.length).toBe(2);
    const oneIdx = lines[0]!.indexOf('1');
    const twoIdx = lines[1]!.indexOf('2');
    expect(oneIdx).toBe(twoIdx);
  });
});
