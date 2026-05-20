import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runUnset } from '../../src/commands/unset.js';

describe('runUnset', () => {
  const origEnv = { ...process.env };
  let stdoutWrites: string[];
  let outSpy: { mockRestore: () => void };

  beforeEach(() => {
    process.env = { ...origEnv };
    stdoutWrites = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { stdoutWrites.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); process.env = origEnv; });

  function out(): string { return stdoutWrites.join(''); }

  it('falls back to a hardcoded list when CCWS_EXPORTED is unset', async () => {
    delete process.env.CCWS_EXPORTED;
    expect(await runUnset([])).toBe(0);
    const lines = out().trimEnd().split('\n');
    expect(lines).toEqual([
      'unset CCWS_NAME',
      'unset CCWS_REAL_HOME',
      'unset CLAUDE_CONFIG_DIR',
      'unset ANTHROPIC_BASE_URL',
      'unset ANTHROPIC_AUTH_TOKEN',
      'unset CCWS_BINARY',
      'unset CCWS_EXPORTED',
    ]);
  });

  it('reads CCWS_EXPORTED and emits unset for each name + a final unset CCWS_EXPORTED', async () => {
    process.env.CCWS_EXPORTED = 'CCWS_NAME,ANTHROPIC_BASE_URL,HTTPS_PROXY';
    expect(await runUnset([])).toBe(0);
    expect(out().trimEnd().split('\n')).toEqual([
      'unset CCWS_NAME',
      'unset ANTHROPIC_BASE_URL',
      'unset HTTPS_PROXY',
      'unset CCWS_EXPORTED',
    ]);
  });

  it('skips invalid identifiers in CCWS_EXPORTED (injection defense)', async () => {
    process.env.CCWS_EXPORTED = 'CCWS_NAME,bad name,$(rm),OK';
    expect(await runUnset([])).toBe(0);
    expect(out().trimEnd().split('\n')).toEqual([
      'unset CCWS_NAME',
      'unset OK',
      'unset CCWS_EXPORTED',
    ]);
  });

  it('emits only the final CCWS_EXPORTED line when CCWS_EXPORTED is empty', async () => {
    process.env.CCWS_EXPORTED = '';
    expect(await runUnset([])).toBe(0);
    expect(out().trimEnd().split('\n')[0]).toBe('unset CCWS_NAME');
  });
});
