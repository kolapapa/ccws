import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from '../src/picker/App.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ccws-app-'));
  for (const name of ['astratech', 'deepseek', 'gradient']) {
    mkdirSync(join(tmp, name));
    writeFileSync(join(tmp, name, 'ccws.env'), `ANTHROPIC_BASE_URL=https://api.anthropic.com\nCCWS_CREATED=2026-01-01\n`);
  }
});

function pass() {
  return {
    envNoLogo: '1',  // disable logo in tests to keep frames small
    stderrIsTTY: true,
    cols: 120,
    lines: 40,
    forceForTests: true,
  };
}

describe('App', () => {
  it('renders all 3 workspaces on initial mount', () => {
    const { lastFrame } = render(<App workspacesDir={tmp} activeName={null} logoGate={pass()} onExit={() => {}} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('astratech');
    expect(frame).toContain('deepseek');
    expect(frame).toContain('gradient');
  });

  it('cursor starts on the first workspace when activeName is null', () => {
    const { lastFrame } = render(<App workspacesDir={tmp} activeName={null} logoGate={pass()} onExit={() => {}} />);
    const lines = (lastFrame() ?? '').split('\n');
    const cursorLine = lines.find((l) => l.includes('❯'));
    expect(cursorLine).toContain('astratech');
  });

  it('cursor starts on the active workspace when activeName is set', () => {
    const { lastFrame } = render(<App workspacesDir={tmp} activeName="deepseek" logoGate={pass()} onExit={() => {}} />);
    const lines = (lastFrame() ?? '').split('\n');
    const cursorLine = lines.find((l) => l.includes('❯'));
    expect(cursorLine).toContain('deepseek');
  });

  it('arrow down moves cursor to next workspace', () => {
    const { lastFrame, stdin } = render(<App workspacesDir={tmp} activeName={null} logoGate={pass()} onExit={() => {}} />);
    stdin.write('\x1b[B');  // ↓
    const lines = (lastFrame() ?? '').split('\n');
    const cursorLine = lines.find((l) => l.includes('❯'));
    expect(cursorLine).toContain('deepseek');
  });

  it('typing into search filters the list', () => {
    const { lastFrame, stdin } = render(<App workspacesDir={tmp} activeName={null} logoGate={pass()} onExit={() => {}} />);
    stdin.write('grad');
    const frame = lastFrame() ?? '';
    expect(frame).toContain('gradient');
    expect(frame).not.toContain('astratech');
    expect(frame).not.toContain('deepseek');
  });

  it('Tab toggles CCWS_DANGEROUS on the current row, preserving cursor', () => {
    const { lastFrame, stdin } = render(<App workspacesDir={tmp} activeName={null} logoGate={pass()} onExit={() => {}} />);
    stdin.write('\x1b[B');  // ↓ to deepseek
    stdin.write('\t');         // Tab
    const envText = readFileSync(join(tmp, 'deepseek', 'ccws.env'), 'utf8');
    expect(envText).toMatch(/^CCWS_DANGEROUS=1$/m);
    const lines = (lastFrame() ?? '').split('\n');
    const cursorLine = lines.find((l) => l.includes('❯'));
    expect(cursorLine).toContain('deepseek');
    expect(lastFrame() ?? '').toContain('⚡ yolo');
  });

  it('Tab again removes CCWS_DANGEROUS, switching back to safe', () => {
    const { lastFrame, stdin } = render(<App workspacesDir={tmp} activeName={null} logoGate={pass()} onExit={() => {}} />);
    stdin.write('\t');  // toggle astratech ON
    stdin.write('\t');  // toggle astratech OFF
    const envText = readFileSync(join(tmp, 'astratech', 'ccws.env'), 'utf8');
    expect(envText).not.toMatch(/CCWS_DANGEROUS=1/);
  });

  it('Enter calls onExit with the cursor workspace name and exitCode 0', () => {
    let received: { name: string; exitCode: number } | null = null;
    const { stdin } = render(
      <App
        workspacesDir={tmp}
        activeName={null}
        logoGate={pass()}
        onExit={(name, exitCode) => { received = { name: name ?? '', exitCode }; }}
      />,
    );
    stdin.write('\x1b[B');  // ↓ to deepseek
    stdin.write('\r');         // Enter
    expect(received).toEqual({ name: 'deepseek', exitCode: 0 });
  });

  it('Esc calls onExit with null name and exitCode 130', () => {
    let received: { name: string | null; exitCode: number } | null = null;
    const { stdin } = render(
      <App
        workspacesDir={tmp}
        activeName={null}
        logoGate={pass()}
        onExit={(name, exitCode) => { received = { name, exitCode }; }}
      />,
    );
    stdin.write('\x1b');  // Esc
    expect(received).toEqual({ name: null, exitCode: 130 });
  });
});
