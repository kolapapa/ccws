import React from 'react';
import { Box } from 'ink';
import type { Workspace } from '../workspace.js';
import { Row } from './Row.js';

export interface ListProps {
  workspaces: Workspace[];
  cursorName: string | null;
}

export const List: React.FC<ListProps> = ({ workspaces, cursorName }) => {
  return (
    <Box flexDirection="column">
      {workspaces.map((ws) => (
        <Row key={ws.name} workspace={ws} isCursor={ws.name === cursorName} />
      ))}
    </Box>
  );
};
