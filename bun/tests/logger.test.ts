import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logInfo, logWarn, logError, logOk } from '../src/logger.js';

describe('logger', () => {
  let writes: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writes = [];
    spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
  });
  afterEach(() => { spy.mockRestore(); });

  it('logInfo writes "ccws: <msg>\\n" to stderr', () => {
    logInfo('hello');
    expect(writes).toEqual(['ccws: hello\n']);
  });

  it('logWarn writes "ccws: warn: <msg>\\n"', () => {
    logWarn('careful');
    expect(writes).toEqual(['ccws: warn: careful\n']);
  });

  it('logError writes "ccws: error: <msg>\\n"', () => {
    logError('boom');
    expect(writes).toEqual(['ccws: error: boom\n']);
  });

  it('logOk writes "ccws: ok: <msg>\\n"', () => {
    logOk('done');
    expect(writes).toEqual(['ccws: ok: done\n']);
  });
});
