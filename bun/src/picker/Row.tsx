import React from 'react';
import { Box, Text } from 'ink';
import type { Workspace } from '../workspace.js';
import { COLORS } from '../colors.js';

const NAME_W = 12;
const EP_W = 24;
// Total visible width of a row, regardless of which optional status
// markers (active / home) are present. Picked as the sum of all fixed
// columns + all possible suffixes so the highlight bar is uniform.
//   2 pointer + 12 name + 2 gap + 24 endpoint + 2 gap
// + 8 proxy + 2 gap + 7 dangerous + 8 home + 10 active = 77
const ROW_W = 77;

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

// Visible-width of a row's content so far — used to compute the trailing
// pad so every row is the same width and the highlight bar is uniform.
//   pointer:    2
//   name:       NAME_W
//   gap:        2
//   endpoint:   EP_W
//   gap:        2
//   proxy:      8  ('● proxy ' or '○ direct')
//   gap:        2
//   danger:     7  ('⚡ yolo ' or '· safe ')
//   home:       8  ('  · home' if present)
//   active:    10  ('  · active' if present)
function contentWidth(ws: Workspace): number {
  return 2 + NAME_W + 2 + EP_W + 2 + 8 + 2 + 7
    + (ws.noIsolate ? 8 : 0)
    + (ws.active ? 10 : 0);
}

export const Row: React.FC<RowProps> = ({ workspace, isCursor }) => {
  const ep = truncate(endpointShort(workspace.endpoint), EP_W);
  const name = truncate(workspace.name, NAME_W);
  // Selected row gets a single uniform background. ink's backgroundColor
  // applies to whatever's inside the Text, regardless of foreground color,
  // so spacers between colored segments don't break into white tiles.
  // The ❯ pointer stays as a redundant cue for colorblind / monochrome.
  const bg = isCursor ? COLORS.dim : undefined;
  const padLen = Math.max(0, ROW_W - contentWidth(workspace));
  const pad = ' '.repeat(padLen);
  return (
    <Text backgroundColor={bg}>
      <Text color={isCursor ? COLORS.green : undefined} bold>
        {isCursor ? '❯ ' : '  '}
      </Text>
      <Text
        color={workspace.active ? COLORS.green : COLORS.pink}
        bold={workspace.active || isCursor}
      >
        {name}
      </Text>
      <Text>  </Text>
      <Text color={endpointColor(endpointShort(workspace.endpoint))}>
        {ep}
      </Text>
      <Text>  </Text>
      {workspace.proxy ? (
        <Text color={COLORS.green}>● proxy </Text>
      ) : (
        <Text color={COLORS.fg}>○ direct</Text>
      )}
      <Text>  </Text>
      {workspace.dangerous ? (
        <Text color={COLORS.red} bold>! yolo </Text>
      ) : (
        <Text color={COLORS.fg}>· safe </Text>
      )}
      {workspace.noIsolate && (
        <Text color={COLORS.lavender} bold>  · home</Text>
      )}
      {workspace.active && (
        <Text color={COLORS.fg}>  · active</Text>
      )}
      <Text>{pad}</Text>
    </Text>
  );
};
