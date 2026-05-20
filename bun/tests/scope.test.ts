import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findLocalFile, readScopeFile, resolveScope } from '../src/scope.js';

describe('scope', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let origCwd: string;

  beforeEach(() => {
    tmp = realpathSync(mkdtempSync(join(tmpdir(), 'ccws-scope-')));
    origCwd = process.cwd();
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    mkdirSync(process.env.CCWS_ROOT, { recursive: true });
  });
  afterEach(() => {
    process.chdir(origCwd);
    rmSync(tmp, { recursive: true, force: true });
    process.env = origEnv;
  });

  it('findLocalFile returns null when no .ccws-workspace exists', () => {
    mkdirSync(join(tmp, 'proj/sub'), { recursive: true });
    expect(findLocalFile(join(tmp, 'proj/sub'))).toBe(null);
  });

  it('findLocalFile walks upward to find .ccws-workspace', () => {
    mkdirSync(join(tmp, 'proj/sub/deeper'), { recursive: true });
    writeFileSync(join(tmp, 'proj/.ccws-workspace'), 'work\n');
    expect(findLocalFile(join(tmp, 'proj/sub/deeper'))).toBe(join(tmp, 'proj/.ccws-workspace'));
  });

  it('readScopeFile returns first non-blank stripped line', () => {
    const f = join(tmp, 's');
    writeFileSync(f, '  work \n\nignored\n');
    expect(readScopeFile(f)).toBe('work');
  });

  it('readScopeFile returns null for empty / whitespace-only', () => {
    const f = join(tmp, 's');
    writeFileSync(f, '   \n');
    expect(readScopeFile(f)).toBe(null);
  });

  it('resolveScope prefers shell env CCWS_NAME', () => {
    process.env.CCWS_NAME = 'shellws';
    writeFileSync(join(process.env.CCWS_ROOT!, 'global'), 'globalws\n');
    expect(resolveScope()).toEqual({ name: 'shellws', source: 'shell' });
  });

  it('resolveScope falls back to .ccws-workspace when CCWS_NAME unset', () => {
    delete process.env.CCWS_NAME;
    mkdirSync(join(tmp, 'proj'), { recursive: true });
    writeFileSync(join(tmp, 'proj/.ccws-workspace'), 'localws\n');
    process.chdir(join(tmp, 'proj'));
    expect(resolveScope()).toEqual({ name: 'localws', source: `local:${join(tmp, 'proj/.ccws-workspace')}` });
  });

  it('resolveScope falls back to global file when no shell + no local', () => {
    delete process.env.CCWS_NAME;
    writeFileSync(join(process.env.CCWS_ROOT!, 'global'), 'globalws\n');
    process.chdir(tmp);
    expect(resolveScope()).toEqual({ name: 'globalws', source: 'global' });
  });

  it('resolveScope returns null when nothing resolves', () => {
    delete process.env.CCWS_NAME;
    process.chdir(tmp);
    expect(resolveScope()).toBe(null);
  });
});
