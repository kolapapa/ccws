import React, { useReducer } from 'react';
import { Box, Text, useInput } from 'ink';
import { Logo } from './Logo.js';
import { List } from './List.js';
import { Preview } from './Preview.js';
import { Search } from './Search.js';
import { reducer, initialState, filtered } from './state.js';
import { scanWorkspaces } from '../workspace.js';
import { setEnvKey, unsetEnvKey } from '../env.js';
import { COLORS, RULE } from '../colors.js';
import type { LogoGateInputs } from '../logoData.js';

export interface AppProps {
  workspacesDir: string;
  activeName: string | null;
  logoGate: LogoGateInputs;
  onExit: (selectedName: string | null, exitCode: number) => void;
}

interface KeyHintProps {
  k: string;
  label: string;
  color?: string;
}
const KeyHint: React.FC<KeyHintProps> = ({ k, label, color }) => (
  <>
    <Text color={color ?? COLORS.mauve} bold>{k}</Text>
    <Text color={COLORS.dim}> {label}</Text>
  </>
);

export const App: React.FC<AppProps> = ({ workspacesDir, activeName, logoGate, onExit }) => {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(scanWorkspaces({ workspacesDir, activeName }), activeName),
  );

  const list = filtered(state.workspaces, state.query);
  const cursor = list.find((w) => w.name === state.cursorName) ?? null;

  useInput((input, key) => {
    if (key.escape) {
      onExit(null, 130);
      return;
    }
    if (key.return) {
      onExit(state.cursorName, 0);
      return;
    }
    if (key.upArrow) {
      dispatch({ type: 'moveCursor', dir: 'up' });
      return;
    }
    if (key.downArrow) {
      dispatch({ type: 'moveCursor', dir: 'down' });
      return;
    }
    if (key.tab) {
      if (cursor) {
        if (cursor.dangerous) {
          unsetEnvKey(cursor.envPath, 'CCWS_DANGEROUS');
        } else {
          setEnvKey(cursor.envPath, 'CCWS_DANGEROUS', '1');
        }
        const fresh = scanWorkspaces({ workspacesDir, activeName });
        dispatch({ type: 'refreshWorkspaces', workspaces: fresh });
      }
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <Logo gate={logoGate} />
      <Text color={COLORS.dim}>{RULE}</Text>
      <Box>
        <KeyHint k="↑↓" label="navigate" />
        <Text color={COLORS.dim}>    </Text>
        <KeyHint k="type" label="to filter" color={COLORS.lavender} />
        <Text color={COLORS.dim}>    </Text>
        <KeyHint k="↵" label="activate" color={COLORS.green} />
        <Text color={COLORS.dim}>    </Text>
        <KeyHint k="Tab" label="toggle yolo" color={COLORS.yellow} />
        <Text color={COLORS.dim}>    </Text>
        <KeyHint k="esc" label="cancel" color={COLORS.red} />
      </Box>
      <Box>{/* spacer */}</Box>
      <Search
        query={state.query}
        onChange={(v) => dispatch({ type: 'setQuery', value: v })}
        shown={list.length}
        total={state.workspaces.length}
      />
      <Box>{/* spacer */}</Box>
      <List workspaces={list} cursorName={state.cursorName} />
      <Text color={COLORS.dim}>{RULE}</Text>
      <Preview workspace={cursor} />
    </Box>
  );
};
