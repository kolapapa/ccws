import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnvFile, setEnvKey, unsetEnvKey } from '../src/env.js';

let tmp: string;
let envPath: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ccws-env-'));
  envPath = join(tmp, 'ccws.env');
});

describe('parseEnvFile', () => {
  it('parses KEY=value lines into a record', () => {
    writeFileSync(envPath, 'ANTHROPIC_BASE_URL=https://api.anthropic.com\nCCWS_NAME=work\n');
    expect(parseEnvFile(envPath)).toEqual({
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      CCWS_NAME: 'work',
    });
  });

  it('skips comments and blank lines', () => {
    writeFileSync(envPath, '# header comment\n\nANTHROPIC_BASE_URL=x\n# trailing comment\n');
    expect(parseEnvFile(envPath)).toEqual({ ANTHROPIC_BASE_URL: 'x' });
  });

  it('skips lines with invalid keys', () => {
    writeFileSync(envPath, '1BADKEY=x\nGOOD_KEY=y\nKEY WITH SPACE=z\nGOOD_KEY2=ok\n');
    expect(parseEnvFile(envPath)).toEqual({ GOOD_KEY: 'y', GOOD_KEY2: 'ok' });
  });

  it('preserves = inside values (only splits on first =)', () => {
    writeFileSync(envPath, 'TOKEN=abc=def=ghi\n');
    expect(parseEnvFile(envPath)).toEqual({ TOKEN: 'abc=def=ghi' });
  });

  it('returns empty object when file does not exist', () => {
    expect(parseEnvFile(join(tmp, 'missing.env'))).toEqual({});
  });

  it('last duplicate wins (matches bash semantics)', () => {
    writeFileSync(envPath, 'K=first\nK=second\nK=third\n');
    expect(parseEnvFile(envPath)).toEqual({ K: 'third' });
  });
});

describe('setEnvKey', () => {
  it('appends when key does not exist', () => {
    writeFileSync(envPath, 'EXISTING=1\n');
    setEnvKey(envPath, 'CCWS_DANGEROUS', '1');
    expect(readFileSync(envPath, 'utf8')).toBe('EXISTING=1\nCCWS_DANGEROUS=1\n');
  });

  it('replaces existing key in place', () => {
    writeFileSync(envPath, 'A=1\nCCWS_DANGEROUS=0\nB=2\n');
    setEnvKey(envPath, 'CCWS_DANGEROUS', '1');
    expect(readFileSync(envPath, 'utf8')).toBe('A=1\nCCWS_DANGEROUS=1\nB=2\n');
  });

  it('preserves comments and blank lines on replace', () => {
    writeFileSync(envPath, '# header\n\nCCWS_DANGEROUS=0\n# tail\n');
    setEnvKey(envPath, 'CCWS_DANGEROUS', '1');
    expect(readFileSync(envPath, 'utf8')).toBe('# header\n\nCCWS_DANGEROUS=1\n# tail\n');
  });

  it('rejects invalid key', () => {
    writeFileSync(envPath, '');
    expect(() => setEnvKey(envPath, '1BAD', '1')).toThrow();
  });
});

describe('unsetEnvKey', () => {
  it('removes the matching line', () => {
    writeFileSync(envPath, 'A=1\nCCWS_DANGEROUS=1\nB=2\n');
    unsetEnvKey(envPath, 'CCWS_DANGEROUS');
    expect(readFileSync(envPath, 'utf8')).toBe('A=1\nB=2\n');
  });

  it('no-op when key absent', () => {
    writeFileSync(envPath, 'A=1\nB=2\n');
    unsetEnvKey(envPath, 'CCWS_DANGEROUS');
    expect(readFileSync(envPath, 'utf8')).toBe('A=1\nB=2\n');
  });
});
