import React, { useReducer, useLayoutEffect, useRef } from 'react';
import { Box, Text, useStdin } from 'ink';
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

export const App: React.FC<AppProps> = ({ workspacesDir, activeName, logoGate, onExit }) => {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(scanWorkspaces({ workspacesDir, activeName }), activeName),
  );

  const { stdin } = useStdin();

  // Use refs to keep the handler stable while reading current state
  const stateRef = useRef(state);
  stateRef.current = state;
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const workspacesDirRef = useRef(workspacesDir);
  workspacesDirRef.current = workspacesDir;
  const activeNameRef = useRef(activeName);
  activeNameRef.current = activeName;

  // useLayoutEffect runs synchronously during commit, so the listener is
  // registered before render() returns — this makes synchronous test writes work.
  useLayoutEffect(() => {
    const handleData = (data: string | Buffer) => {
      const s = String(data);
      const st = stateRef.current;
      const list = filtered(st.workspaces, st.query);
      const cursor = list.find((w) => w.name === st.cursorName) ?? null;

      if (s === '\x1b') {
        // Escape
        onExitRef.current(null, 130);
        return;
      }
      if (s === '\r' || s === '\n') {
        // Enter / Return
        onExitRef.current(st.cursorName, 0);
        return;
      }
      if (s === '\x1b[A') {
        // Up arrow
        dispatch({ type: 'moveCursor', dir: 'up' });
        return;
      }
      if (s === '\x1b[B') {
        // Down arrow
        dispatch({ type: 'moveCursor', dir: 'down' });
        return;
      }
      if (s === '\t') {
        // Tab — toggle CCWS_DANGEROUS
        if (cursor) {
          if (cursor.dangerous) {
            unsetEnvKey(cursor.envPath, 'CCWS_DANGEROUS');
          } else {
            setEnvKey(cursor.envPath, 'CCWS_DANGEROUS', '1');
          }
          const fresh = scanWorkspaces({
            workspacesDir: workspacesDirRef.current,
            activeName: activeNameRef.current,
          });
          dispatch({ type: 'refreshWorkspaces', workspaces: fresh });
        }
        return;
      }
      // Ignore other escape sequences (e.g., \x1b[C, \x1b[D, etc.)
      if (s.startsWith('\x1b')) {
        return;
      }
      // Ignore control characters (except those already handled)
      if (s.charCodeAt(0) < 32) {
        return;
      }
      // Text character(s) — append to search query
      const newQuery = st.query + s;
      dispatch({ type: 'setQuery', value: newQuery });
    };

    stdin.on('data', handleData);
    return () => {
      stdin.off('data', handleData);
    };
  }, [stdin]);

  const list = filtered(state.workspaces, state.query);
  const cursor = list.find((w) => w.name === state.cursorName) ?? null;

  return (
    <Box flexDirection="column">
      <Logo gate={logoGate} />
      <Text color={COLORS.dim}>{RULE}</Text>
      <Text color={COLORS.dim}>
        {'↑↓ navigate    type to filter    ↵ activate    Tab toggle yolo    esc cancel'}
      </Text>
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
