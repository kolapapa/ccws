import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Logo } from '../src/picker/Logo.js';

const pass = {
  envNoLogo: undefined,
  stderrIsTTY: true,
  cols: 80,
  lines: 40,
  forceForTests: true,
} as const;

describe('Logo', () => {
  it('renders 6 logo lines when all gates pass', () => {
    const { lastFrame } = render(<Logo gate={pass} />);
    const frame = lastFrame() ?? '';
    const logoRows = frame.split('\n').filter((row) => /[█═]/.test(row));
    expect(logoRows.length).toBeGreaterThanOrEqual(6);
  });

  it('renders nothing when CCWS_NO_LOGO=1', () => {
    const { lastFrame } = render(<Logo gate={{ ...pass, envNoLogo: '1' }} />);
    expect(lastFrame() ?? '').not.toMatch(/█/);
  });

  it('renders nothing when cols<36', () => {
    const { lastFrame } = render(<Logo gate={{ ...pass, cols: 30 }} />);
    expect(lastFrame() ?? '').not.toMatch(/█/);
  });

  it('renders nothing when lines<24', () => {
    const { lastFrame } = render(<Logo gate={{ ...pass, lines: 20 }} />);
    expect(lastFrame() ?? '').not.toMatch(/█/);
  });

  it('renders nothing when stderr is not a tty and force is off', () => {
    const { lastFrame } = render(<Logo gate={{ ...pass, stderrIsTTY: false, forceForTests: false }} />);
    expect(lastFrame() ?? '').not.toMatch(/█/);
  });
});
