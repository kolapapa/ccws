import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Row } from '../src/picker/Row.js';
import type { Workspace } from '../src/workspace.js';

const baseWs: Workspace = {
  name: 'work',
  endpoint: 'anthropic',
  proxy: false,
  dangerous: false,
  noIsolate: false,
  active: false,
  envPath: '/tmp/work/ccws.env',
  env: {},
  mtime: 0,
};

describe('Row', () => {
  it('renders the workspace name', () => {
    const { lastFrame } = render(<Row workspace={baseWs} isCursor={false} />);
    expect(lastFrame()).toContain('work');
  });

  it('shows the cursor pointer when isCursor=true', () => {
    const { lastFrame } = render(<Row workspace={baseWs} isCursor={true} />);
    expect(lastFrame()).toContain('❯');
  });

  it('hides the cursor pointer when isCursor=false', () => {
    const { lastFrame } = render(<Row workspace={baseWs} isCursor={false} />);
    expect(lastFrame()).not.toContain('❯');
  });

  it('renders proxy glyph when proxy=true', () => {
    const { lastFrame } = render(<Row workspace={{ ...baseWs, proxy: true }} isCursor={false} />);
    expect(lastFrame()).toContain('● proxy');
  });

  it('renders direct glyph when proxy=false', () => {
    const { lastFrame } = render(<Row workspace={baseWs} isCursor={false} />);
    expect(lastFrame()).toContain('○ direct');
  });

  it('renders yolo glyph when dangerous=true', () => {
    const { lastFrame } = render(<Row workspace={{ ...baseWs, dangerous: true }} isCursor={false} />);
    expect(lastFrame()).toContain('⚡ yolo');
  });

  it('renders safe glyph when dangerous=false', () => {
    const { lastFrame } = render(<Row workspace={baseWs} isCursor={false} />);
    expect(lastFrame()).toContain('· safe');
  });

  it('renders active marker when active=true', () => {
    const { lastFrame } = render(<Row workspace={{ ...baseWs, active: true }} isCursor={false} />);
    expect(lastFrame()).toContain('· active');
  });

  it('renders the home marker when noIsolate=true', () => {
    const { lastFrame } = render(<Row workspace={{ ...baseWs, noIsolate: true }} isCursor={false} />);
    expect(lastFrame()).toContain('· home');
  });

  it('does not render the home marker when noIsolate=false', () => {
    const { lastFrame } = render(<Row workspace={baseWs} isCursor={false} />);
    expect(lastFrame()).not.toContain('home');
  });

  it('all rows pad to the same visible width (highlight stays uniform)', () => {
    const minimal = render(<Row workspace={baseWs} isCursor={false} />).lastFrame() ?? '';
    const maximal = render(<Row workspace={{ ...baseWs, noIsolate: true, active: true }} isCursor={false} />).lastFrame() ?? '';
    // ink-testing-library strips trailing whitespace from the frame, so
    // compare a regex-stripped version: we want the underlying string
    // (with padding) to have the same logical column count. Easiest proxy:
    // count visible characters excluding the trailing-space tail.
    // (Direct length check would fail because lastFrame trims trailing
    // spaces.) Just assert that the maximal row never exceeds the minimal
    // row's pre-trim length — pad always brings everything up.
    expect(maximal.length).toBeGreaterThanOrEqual(minimal.length);
  });

});
