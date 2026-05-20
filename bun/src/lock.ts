import { mkdirSync, rmdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { lockFile } from './paths.js';

export async function withLock<T>(timeoutSec: number, fn: () => Promise<T>): Promise<T> {
  const lf = lockFile();
  mkdirSync(dirname(lf), { recursive: true });
  const lockdir = `${lf}.d`;

  const startMs = Date.now();
  const deadlineMs = startMs + Math.max(0, timeoutSec) * 1000;
  while (true) {
    try {
      mkdirSync(lockdir);
      break;
    } catch (e) {
      if (Date.now() >= deadlineMs) {
        throw new Error(`could not acquire lock within ${timeoutSec}s (held by another ccws op)`);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  try {
    return await fn();
  } finally {
    try { rmdirSync(lockdir); } catch { /* nothing to release */ }
  }
}
