import React from 'react';
import { Box, Text } from 'ink';
import type { Workspace } from '../workspace.js';
import { COLORS } from '../colors.js';

const NAME_W = 12;
const EP_W = 24;

function endpointShort(url: string): string {
  if (url === '' || url === 'anthropic' || url.includes('api.anthropic.com')) return 'anthropic';
  if (url.includes('api.deepseek.com')) return 'deepseek-gw';
  if (url.includes('api.openai.com')) return 'openai-gw';
  const m = url.match(/^[a-z]+:\/\/([^/]+)/);
  return m ? m[1]! : url;
}

function truncate(s: string, w: number): string {
  if (s.length <= w) return s.padEnd(w);
  return s.slice(0, w - 1) + '…';
}

function endpointColor(short: string): string {
  if (short === 'anthropic') return COLORS.sky;
  if (short.endsWith('-gw')) return COLORS.yellow;
  return COLORS.lavender;
}

export interface RowProps {
  workspace: Workspace;
  isCursor: boolean;
}

export const Row: React.FC<RowProps> = ({ workspace, isCursor }) => {
  const ep = truncate(endpointShort(workspace.endpoint), EP_W);
  const name = truncate(workspace.name, NAME_W);
  return (
    <Box>
      <Text color={COLORS.green} bold>
        {isCursor ? '❯ ' : '  '}
      </Text>
      <Text color={workspace.active ? COLORS.green : COLORS.pink} bold={workspace.active}>
        {name}
      </Text>
      <Text>  </Text>
      <Text color={endpointColor(endpointShort(workspace.endpoint))}>{ep}</Text>
      <Text>  </Text>
      {workspace.proxy ? (
        <Text color={COLORS.green}>● proxy </Text>
      ) : (
        <Text color={COLORS.dim}>○ direct</Text>
      )}
      <Text>  </Text>
      {workspace.dangerous ? (
        <Text color={COLORS.red}>⚡ yolo </Text>
      ) : (
        <Text color={COLORS.dim}>· safe </Text>
      )}
      {workspace.active && (
        <Text color={COLORS.dim}>  · active</Text>
      )}
    </Box>
  );
};
