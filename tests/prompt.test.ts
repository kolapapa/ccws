import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promptLine, promptHidden, promptYn, _setReader } from '../src/prompt.js';

describe('prompt', () => {
  let writes: string[];
  let spy: { mockRestore: () => void };

  beforeEach(() => {
    writes = [];
    spy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => {
      writes.push(String(c));
      return true;
    });
  });
  afterEach(() => { spy.mockRestore(); _setReader(null); });

  it('promptLine writes the question to stderr and returns the line', async () => {
    _setReader(async () => 'work\n');
    const r = await promptLine('Name: ');
    expect(r).toBe('work');
    expect(writes).toEqual(['Name: ']);
  });

  it('promptLine returns empty string on EOF', async () => {
    _setReader(async () => null);
    expect(await promptLine('? ')).toBe('');
  });

  it('promptHidden strips trailing newline and writes a final newline to stderr', async () => {
    _setReader(async () => 'secret\n');
    const r = await promptHidden('Token: ');
    expect(r).toBe('secret');
    expect(writes).toEqual(['Token: ', '\n']);
  });

  it('promptYn defaults to Y on empty input', async () => {
    _setReader(async () => '\n');
    expect(await promptYn('ok?', 'Y')).toBe(true);
  });

  it('promptYn defaults to N on empty input when default is N', async () => {
    _setReader(async () => '\n');
    expect(await promptYn('ok?', 'N')).toBe(false);
  });

  it.each([['y', true], ['Y', true], ['yes', true], ['n', false], ['N', false], ['no', false]])(
    'promptYn parses %s as %s',
    async (input, expected) => {
      _setReader(async () => `${input}\n`);
      expect(await promptYn('?', 'N')).toBe(expected);
    },
  );
});
