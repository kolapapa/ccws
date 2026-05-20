import { describe, it, expect } from 'vitest';
import { reducer, initialState, type State, type Action } from '../src/picker/state.js';
import type { Workspace } from '../src/workspace.js';

function ws(name: string, overrides: Partial<Workspace> = {}): Workspace {
  return {
    name,
    endpoint: 'anthropic',
    proxy: false,
    dangerous: false,
    active: false,
    envPath: `/tmp/${name}/ccws.env`,
    env: {},
    mtime: 0,
    ...overrides,
  };
}

const A = ws('astratech');
const D = ws('deepseek');
const G = ws('gradient');

describe('reducer', () => {
  it('moveCursor down advances cursorName in the filtered order', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'astratech' };
    const next = reducer(s, { type: 'moveCursor', dir: 'down' });
    expect(next.cursorName).toBe('deepseek');
  });

  it('moveCursor down at end is a no-op (no wrap)', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'gradient' };
    const next = reducer(s, { type: 'moveCursor', dir: 'down' });
    expect(next.cursorName).toBe('gradient');
  });

  it('moveCursor up at start is a no-op', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'astratech' };
    const next = reducer(s, { type: 'moveCursor', dir: 'up' });
    expect(next.cursorName).toBe('astratech');
  });

  it('setQuery filters by fuzzy substring of name', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'astratech' };
    const next = reducer(s, { type: 'setQuery', value: 'deep' });
    expect(next.query).toBe('deep');
    expect(next.cursorName).toBe('deepseek');
  });

  it('setQuery cursor stays put if it is in the filtered set', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'gradient' };
    const next = reducer(s, { type: 'setQuery', value: 'r' });
    expect(next.cursorName).toBe('gradient');
  });

  it('setQuery snaps cursor to first filtered match when current cursor is filtered out', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'deepseek' };
    const next = reducer(s, { type: 'setQuery', value: 'a' });
    expect(next.cursorName).toBe('astratech');
  });

  it('setQuery empty restores full list (cursor preserved if still present)', () => {
    const s: State = { workspaces: [A, D, G], query: 'a', cursorName: 'astratech' };
    const next = reducer(s, { type: 'setQuery', value: '' });
    expect(next.cursorName).toBe('astratech');
  });

  it('refreshWorkspaces replaces array, preserves cursor by name when possible', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'deepseek' };
    const Dyolo = ws('deepseek', { dangerous: true });
    const next = reducer(s, { type: 'refreshWorkspaces', workspaces: [A, Dyolo, G] });
    expect(next.cursorName).toBe('deepseek');
    expect(next.workspaces[1]!.dangerous).toBe(true);
  });

  it('refreshWorkspaces snaps cursor to first when the previous cursor name is gone', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'deepseek' };
    const next = reducer(s, { type: 'refreshWorkspaces', workspaces: [A, G] });
    expect(next.cursorName).toBe('astratech');
  });

  it('initialState picks cursor = active workspace when present, else first', () => {
    const s1 = initialState([A, D, G], 'gradient');
    expect(s1.cursorName).toBe('gradient');
    const s2 = initialState([A, D, G], null);
    expect(s2.cursorName).toBe('astratech');
    const s3 = initialState([A, D, G], 'nonexistent');
    expect(s3.cursorName).toBe('astratech');
  });
});

describe('filtered', () => {
  it('empty query returns all', async () => {
    const { filtered } = await import('../src/picker/state.js');
    expect(filtered([A, D, G], '').map((w) => w.name)).toEqual(['astratech', 'deepseek', 'gradient']);
  });

  it('substring match is case-insensitive', async () => {
    const { filtered } = await import('../src/picker/state.js');
    expect(filtered([A, D, G], 'GRAD').map((w) => w.name)).toEqual(['gradient']);
  });
});
