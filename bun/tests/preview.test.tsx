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
  it('renders endpoint + token label/value pairs', () => {
    const ws = makeWs({
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      ANTHROPIC_AUTH_TOKEN: 'secret',
    });
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('endpoint');
    expect(frame).toContain('https://api.anthropic.com');
    expect(frame).toContain('token');
    expect(frame).toContain('***');
    expect(frame).not.toContain('secret');
  });

  it('dedupes labels (HTTPS_PROXY + http_proxy both label "proxy" → one row)', () => {
    const ws = makeWs({
      HTTPS_PROXY: 'http://1.2.3.4:8080',
      http_proxy: 'http://1.2.3.4:8080',
    });
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    const proxyRows = frame.split('\n').filter((row) => /\bproxy\b/.test(row));
    expect(proxyRows.length).toBe(1);
  });

  it('masks *_TOKEN, *_AUTH, *_AUTH_TOKEN values', () => {
    const ws = makeWs({ ANTHROPIC_AUTH_TOKEN: 's3cret' });
    const { lastFrame } = render(<Preview workspace={ws} />);
    expect(lastFrame()).toContain('***');
    expect(lastFrame()).not.toContain('s3cret');
  });

  it('renders (ccws.env empty or malformed) warning when env is empty', () => {
    const ws = makeWs({});
    const { lastFrame } = render(<Preview workspace={ws} />);
    expect(lastFrame()).toContain('(ccws.env empty or malformed)');
  });
});
