import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { withLock } from '../src/lock.js';

describe('withLock', () => {
  let tmp: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-lock-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    mkdirSync(process.env.CCWS_ROOT, { recursive: true });
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    process.env = origEnv;
  });

  it('runs the callback and returns its value', async () => {
    const result = await withLock(2, async () => 42);
    expect(result).toBe(42);
  });

  it('releases the lock so a second call succeeds', async () => {
    await withLock(2, async () => {});
    const result = await withLock(2, async () => 'second');
    expect(result).toBe('second');
  });

  it('throws when the lock cannot be acquired in time', async () => {
    const blocker = withLock(5, async () => {
      await new Promise((r) => setTimeout(r, 800));
    });
    await new Promise((r) => setTimeout(r, 50));
    await expect(withLock(0, async () => 'never')).rejects.toThrow(/lock/i);
    await blocker;
  });

  it('releases the lock even if the callback throws', async () => {
    await expect(withLock(2, async () => { throw new Error('oops'); })).rejects.toThrow('oops');
    const result = await withLock(2, async () => 'after-throw');
    expect(result).toBe('after-throw');
  });
});
