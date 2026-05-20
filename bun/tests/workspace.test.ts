import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scanWorkspaces } from '../src/workspace.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'workspaces');

describe('scanWorkspaces', () => {
  it('lists all workspace directories with metadata', () => {
    const ws = scanWorkspaces({ workspacesDir: FIXTURES, activeName: null });
    const names = ws.map((w) => w.name).sort();
    expect(names).toEqual(['danger-ws', 'home-ws', 'proxied', 'work']);
  });

  it('sorts home (noIsolate=true) workspaces before others, alphabetically within group', () => {
    const ws = scanWorkspaces({ workspacesDir: FIXTURES, activeName: null });
    // home-ws is the only noIsolate fixture — it must come first.
    expect(ws[0]!.name).toBe('home-ws');
    // The rest are alphabetical.
    const rest = ws.slice(1).map((w) => w.name);
    expect(rest).toEqual(['danger-ws', 'proxied', 'work']);
  });

  it('detects noIsolate when CCWS_NO_ISOLATE=1', () => {
    const ws = scanWorkspaces({ workspacesDir: FIXTURES, activeName: null });
    expect(ws.find((w) => w.name === 'home-ws')!.noIsolate).toBe(true);
    expect(ws.find((w) => w.name === 'work')!.noIsolate).toBe(false);
  });

  it('detects proxy when HTTPS_PROXY / http_proxy / etc. is set', () => {
    const ws = scanWorkspaces({ workspacesDir: FIXTURES, activeName: null });
    expect(ws.find((w) => w.name === 'proxied')!.proxy).toBe(true);
    expect(ws.find((w) => w.name === 'work')!.proxy).toBe(false);
  });

  it('detects dangerous when CCWS_DANGEROUS=1', () => {
    const ws = scanWorkspaces({ workspacesDir: FIXTURES, activeName: null });
    expect(ws.find((w) => w.name === 'danger-ws')!.dangerous).toBe(true);
    expect(ws.find((w) => w.name === 'work')!.dangerous).toBe(false);
  });

  it('marks active workspace when activeName matches', () => {
    const ws = scanWorkspaces({ workspacesDir: FIXTURES, activeName: 'work' });
    expect(ws.find((w) => w.name === 'work')!.active).toBe(true);
    expect(ws.find((w) => w.name === 'proxied')!.active).toBe(false);
  });

  it('returns empty array when workspacesDir does not exist', () => {
    expect(scanWorkspaces({ workspacesDir: '/nonexistent/path', activeName: null })).toEqual([]);
  });

  it('exposes parsed env for preview consumption', () => {
    const ws = scanWorkspaces({ workspacesDir: FIXTURES, activeName: null });
    const proxied = ws.find((w) => w.name === 'proxied')!;
    expect(proxied.env.HTTPS_PROXY).toBe('http://127.0.0.1:7890');
  });

  it('endpoint falls back to "anthropic" when ANTHROPIC_BASE_URL missing', () => {
    const { mkdtempSync, writeFileSync, mkdirSync } = require('node:fs') as typeof import('node:fs');
    const { tmpdir } = require('node:os') as typeof import('node:os');
    const tmp = mkdtempSync(join(tmpdir(), 'ccws-noend-'));
    mkdirSync(join(tmp, 'bare'));
    writeFileSync(join(tmp, 'bare', 'ccws.env'), 'CCWS_CREATED=2026-01-01\n');
    const ws = scanWorkspaces({ workspacesDir: tmp, activeName: null });
    expect(ws[0]!.endpoint).toBe('anthropic');
  });
});
