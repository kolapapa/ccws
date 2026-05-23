import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { parseUpgradeArgs, runUpgrade } from '../../src/commands/upgrade.js';

describe('parseUpgradeArgs', () => {
  it('returns defaults for no args', () => {
    expect(parseUpgradeArgs([])).toEqual({ check: false, version: '', showHelp: false });
  });

  it('parses --check', () => {
    expect(parseUpgradeArgs(['--check'])).toEqual({ check: true, version: '', showHelp: false });
  });

  it('parses --version v1.0.1', () => {
    expect(parseUpgradeArgs(['--version', 'v1.0.1'])).toEqual({ check: false, version: 'v1.0.1', showHelp: false });
  });

  it('parses --check and --version together', () => {
    expect(parseUpgradeArgs(['--check', '--version', 'v1.0.0'])).toEqual({ check: true, version: 'v1.0.0', showHelp: false });
  });

  it('parses --help and -h', () => {
    expect(parseUpgradeArgs(['--help'])).toEqual({ check: false, version: '', showHelp: true });
    expect(parseUpgradeArgs(['-h'])).toEqual({ check: false, version: '', showHelp: true });
  });

  it('errors on unknown flag', () => {
    const r = parseUpgradeArgs(['--wat']);
    expect('error' in r && r.error).toMatch(/unknown flag/);
  });

  it('errors when --version has no value', () => {
    const r = parseUpgradeArgs(['--version']);
    expect('error' in r && r.error).toMatch(/--version requires a value/);
  });

  it('errors when --version is followed by another flag', () => {
    // Catches `ccws upgrade --version --check` — user forgot the value.
    const r = parseUpgradeArgs(['--version', '--check']);
    expect('error' in r && r.error).toMatch(/--version requires a value/);
  });
});

describe('runUpgrade', () => {
  let outs: string[]; let errs: string[];
  let outSpy: { mockRestore: () => void };
  let errSpy: { mockRestore: () => void };

  beforeEach(() => {
    outs = []; errs = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { outs.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); errSpy.mockRestore(); });

  it('--help returns 0 and prints usage', async () => {
    expect(await runUpgrade(['--help'])).toBe(0);
    expect(errs.join('')).toMatch(/Usage:/);
    expect(errs.join('')).toMatch(/--check/);
    expect(errs.join('')).toMatch(/--version/);
  });

  it('exits 2 on unknown flag and prints usage', async () => {
    expect(await runUpgrade(['--bogus'])).toBe(2);
    expect(errs.join('')).toMatch(/unknown flag/);
    expect(errs.join('')).toMatch(/Usage:/);
  });

  it('exits 2 when --version has no value', async () => {
    expect(await runUpgrade(['--version'])).toBe(2);
    expect(errs.join('')).toMatch(/--version requires a value/);
  });

  it('--check --version reports "on latest" when target equals current', async () => {
    const { VERSION } = await import('../../src/version.js');
    expect(await runUpgrade(['--check', '--version', VERSION])).toBe(0);
    expect(outs.join('')).toMatch(new RegExp(`ccws v${VERSION} \\(latest\\)`));
  });

  it('--check --version reports delta when target differs', async () => {
    // Pinning to a different version skips the network fetch entirely,
    // so this test runs offline.
    expect(await runUpgrade(['--check', '--version', 'v99.99.99'])).toBe(0);
    expect(outs.join('')).toMatch(/→ v99\.99\.99 available/);
    expect(outs.join('')).toMatch(/Run 'ccws upgrade'/);
  });

  it('normalizes bare version strings to v-prefixed in output', async () => {
    expect(await runUpgrade(['--check', '--version', '99.99.99'])).toBe(0);
    expect(outs.join('')).toMatch(/→ v99\.99\.99 available/);
  });
});
