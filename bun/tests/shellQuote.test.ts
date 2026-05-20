import { describe, it, expect } from 'vitest';
import { shQuote } from '../src/shellQuote.js';

describe('shQuote', () => {
  it('quotes empty string', () => {
    expect(shQuote('')).toBe("''");
  });

  it('quotes simple alphanumeric', () => {
    expect(shQuote('abc123')).toBe("'abc123'");
  });

  it('quotes strings with spaces', () => {
    expect(shQuote('hello world')).toBe("'hello world'");
  });

  it('escapes single quotes via end-quote, escaped-quote, reopen', () => {
    expect(shQuote("it's")).toBe("'it'\\''s'");
  });

  it('quotes shell metacharacters safely', () => {
    expect(shQuote('$(rm -rf /)')).toBe("'$(rm -rf /)'");
    expect(shQuote('`echo`')).toBe("'`echo`'");
    expect(shQuote('a;b|c&d')).toBe("'a;b|c&d'");
  });

  it('quotes URLs verbatim', () => {
    expect(shQuote('https://api.anthropic.com')).toBe("'https://api.anthropic.com'");
  });

  it('round-trips through bash eval', async () => {
    const values = ['', 'abc', "it's", '$(echo bad)', 'a b c', '\\nliteral'];
    for (const v of values) {
      const quoted = shQuote(v);
      const proc = Bun.spawn({
        cmd: ['bash', '-c', `printf '%s' ${quoted}`],
        stdout: 'pipe',
      });
      const out = await new Response(proc.stdout).text();
      expect(out).toBe(v);
    }
  });
});
