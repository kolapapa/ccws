// bun/tests/paths.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ccwsRoot, workspacesDir, wsDir, envFile, lockFile, globalScopeFile, realClaudeDir } from '../src/paths.js';

describe('paths', () => {
  const origEnv = { ...process.env };
  beforeEach(() => { process.env = { ...origEnv }; });
  afterEach(() => { process.env = origEnv; });

  it('ccwsRoot defaults to $HOME/.ccws', () => {
    process.env.HOME = '/tmp/h';
    delete process.env.CCWS_ROOT;
    expect(ccwsRoot()).toBe('/tmp/h/.ccws');
  });

  it('ccwsRoot honors $CCWS_ROOT override', () => {
    process.env.CCWS_ROOT = '/tmp/override';
    expect(ccwsRoot()).toBe('/tmp/override');
  });

  it('workspacesDir is ccwsRoot/workspaces', () => {
    process.env.CCWS_ROOT = '/r';
    expect(workspacesDir()).toBe('/r/workspaces');
  });

  it('wsDir joins workspace name', () => {
    process.env.CCWS_ROOT = '/r';
    expect(wsDir('work')).toBe('/r/workspaces/work');
  });

  it('envFile is wsDir/ccws.env', () => {
    process.env.CCWS_ROOT = '/r';
    expect(envFile('work')).toBe('/r/workspaces/work/ccws.env');
  });

  it('lockFile is ccwsRoot/lock', () => {
    process.env.CCWS_ROOT = '/r';
    expect(lockFile()).toBe('/r/lock');
  });

  it('globalScopeFile is ccwsRoot/global', () => {
    process.env.CCWS_ROOT = '/r';
    expect(globalScopeFile()).toBe('/r/global');
  });

  it('realClaudeDir defaults to $HOME/.claude', () => {
    process.env.HOME = '/tmp/h';
    delete process.env.CCWS_REAL_CLAUDE_DIR;
    expect(realClaudeDir()).toBe('/tmp/h/.claude');
  });

  it('realClaudeDir honors $CCWS_REAL_CLAUDE_DIR override', () => {
    process.env.CCWS_REAL_CLAUDE_DIR = '/c';
    expect(realClaudeDir()).toBe('/c');
  });
});
