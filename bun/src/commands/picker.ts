import React from 'react';
import { render } from 'ink';
import { App } from '../picker/App.js';
import { scanWorkspaces, defaultWorkspacesDir } from '../workspace.js';
import type { LogoGateInputs } from '../logoData.js';

function gateInputs(): LogoGateInputs {
  return {
    envNoLogo: process.env.CCWS_NO_LOGO,
    stderrIsTTY: Boolean(process.stderr.isTTY),
    cols: process.stdout.columns ?? 80,
    lines: process.stdout.rows ?? 24,
  };
}

export async function runPicker(): Promise<number> {
  const workspacesDir = defaultWorkspacesDir();
  const initial = scanWorkspaces({ workspacesDir, activeName: process.env.CCWS_NAME ?? null });
  if (initial.length === 0) {
    process.stderr.write("ccws: warn: no workspaces — run 'ccws add <name>'\n");
    return 1;
  }
  return new Promise<number>((resolve) => {
    const inkInstance = render(
      React.createElement(App, {
        workspacesDir,
        activeName: process.env.CCWS_NAME ?? null,
        logoGate: gateInputs(),
        onExit: (selected, exitCode) => {
          inkInstance.unmount();
          if (selected !== null && exitCode === 0) {
            process.stdout.write(`${selected}\n`);
          }
          resolve(exitCode);
        },
      }),
      { stdout: process.stderr, exitOnCtrlC: false },
    );
    inkInstance.waitUntilExit().catch(() => resolve(1));
  });
}
