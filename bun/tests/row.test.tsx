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

});
