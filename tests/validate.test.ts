import { describe, it, expect } from 'vitest';
import { validateName } from '../src/validate.js';

describe('validateName', () => {
  it.each([
    ['work', true],
    ['my-workspace', true],
    ['team_2', true],
    ['a', true],
    ['A1', true],
    ['abc123', true],
  ])('accepts %s', (name, ok) => {
    expect(validateName(name).ok).toBe(ok);
  });

  it.each([
    ['', 'empty'],
    ['_leading', 'must be'],
    ['-leading', 'must be'],
    ['has space', 'must be'],
    ['has/slash', 'must be'],
    ['..', 'must be'],
    ['.dot', 'must be'],
    ['x'.repeat(65), 'too long'],
  ])('rejects %s', (name, reason) => {
    const r = validateName(name);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(reason);
  });

  it.each([
    'add', 'init', 'list', 'use', 'unset', 'current', 'rm', 'sync',
    'doctor', 'tui', 'none', 'default-tui', 'local', 'global', 'which', 'hook',
  ])('rejects reserved name %s', (name) => {
    const r = validateName(name);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('reserved');
  });

  it('rejects double-dash prefixed names', () => {
    const r = validateName('--help');
    expect(r.ok).toBe(false);
  });
});
