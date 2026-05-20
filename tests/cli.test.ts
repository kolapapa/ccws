import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatch } from '../src/cli.js';
import { VERSION } from '../src/version.js';

describe('cli.dispatch', () => {
  let stdoutWrites: string[];
  let stderrWrites: string[];
  let outSpy: { mockRestore: () => void };
  let errSpy: { mockRestore: () => void };

  beforeEach(() => {
    stdoutWrites = [];
    stderrWrites = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { stdoutWrites.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { stderrWrites.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); errSpy.mockRestore(); });

  it('--version prints the version constant', async () => {
    const code = await dispatch(['--version']);
    expect(code).toBe(0);
    expect(stdoutWrites.join('')).toBe(`ccws ${VERSION}\n`);
  });

  it('-V prints the version constant', async () => {
    const code = await dispatch(['-V']);
    expect(code).toBe(0);
    expect(stdoutWrites.join('')).toBe(`ccws ${VERSION}\n`);
  });

  it('--help prints usage to stdout and exits 0', async () => {
    const code = await dispatch(['--help']);
    expect(code).toBe(0);
    expect(stdoutWrites.join('')).toMatch(/^ccws — /);
    expect(stdoutWrites.join('')).toMatch(/Usage:/);
  });

  it('unknown subcommand prints usage to stderr and exits 2', async () => {
    const code = await dispatch(['nonsense']);
    expect(code).toBe(2);
    expect(stderrWrites.join('')).toMatch(/unknown command: nonsense/);
  });

  it('no args returns sentinel PICKER for the entry point to render', async () => {
    const code = await dispatch([]);
    expect(code).toBe(-1);
  });
});

describe('cli registration completeness', () => {
  it('every documented subcommand is registered', async () => {
    const { dispatch } = await import('../src/cli.js');
    const subcommands = ['add', 'init', 'list', 'current', 'use', 'unset', 'local', 'global', 'which', 'hook', 'rm', 'sync', 'doctor'];
    const stderrWrites: string[] = [];
    const stdoutWrites: string[] = [];
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { stderrWrites.push(String(c)); return true; });
    const outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { stdoutWrites.push(String(c)); return true; });
    try {
      for (const c of subcommands) {
        stderrWrites.length = 0; stdoutWrites.length = 0;
        await dispatch([c, '--help']).catch(() => {});
        expect(stderrWrites.join('')).not.toMatch(new RegExp(`unknown command: ${c}`));
      }
    } finally {
      errSpy.mockRestore();
      outSpy.mockRestore();
    }
  });
});
