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
  // Selected row gets full-line inverse highlight (fzf-style), so the cursor
  // is unmistakable even at a glance. The ❯ pointer stays as a redundant cue
  // for colorblind users / monochrome terminals.
  const inv = isCursor;
  return (
    <Box>
      <Text color={isCursor ? COLORS.green : undefined} bold inverse={inv}>
        {isCursor ? '❯ ' : '  '}
      </Text>
      <Text
        color={workspace.active ? COLORS.green : COLORS.pink}
        bold={workspace.active || isCursor}
        inverse={inv}
      >
        {name}
      </Text>
      <Text inverse={inv}>  </Text>
      <Text color={endpointColor(endpointShort(workspace.endpoint))} inverse={inv}>
        {ep}
      </Text>
      <Text inverse={inv}>  </Text>
      {workspace.proxy ? (
        <Text color={COLORS.green} inverse={inv}>● proxy </Text>
      ) : (
        <Text color={COLORS.dim} inverse={inv}>○ direct</Text>
      )}
      <Text inverse={inv}>  </Text>
      {workspace.dangerous ? (
        <Text color={COLORS.red} inverse={inv}>⚡ yolo </Text>
      ) : (
        <Text color={COLORS.dim} inverse={inv}>· safe </Text>
      )}
      {workspace.active && (
        <Text color={COLORS.dim} inverse={inv}>  · active</Text>
      )}
    </Box>
  );
};
