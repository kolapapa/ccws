import React from 'react';
import { Box, Text } from 'ink';
import { dirname } from 'node:path';
import type { Workspace } from '../workspace.js';
import { COLORS } from '../colors.js';

const TOKEN_LIKE = /(_TOKEN|_AUTH|_AUTH_TOKEN|_KEY)$/i;

// Workspace identity — handled elsewhere in the picker / row, don't repeat
// in the preview. CCWS_NAME shows in the row, CCWS_DANGEROUS shows as the
// yolo/safe glyph. Everything else the user wrote in ccws.env shows here
// verbatim.
const INTERNAL_KEYS = new Set(['CCWS_NAME', 'CCWS_DANGEROUS']);

// Max path length before mid-string ellipsis. 60 fits the typical 80-col
// terminal once you account for the "CLAUDE_CONFIG_DIR  " label gutter.
const PATH_MAX = 60;

interface Row {
  label: string;
  value: string;
}

function maskIfSecret(envName: string, value: string): string {
  if (TOKEN_LIKE.test(envName) && value !== '') return '***';
  return value;
}

function tildeify(p: string): string {
  const home = process.env.HOME ?? '';
  if (home !== '' && p.startsWith(home + '/')) return '~' + p.slice(home.length);
  if (home !== '' && p === home) return '~';
  return p;
}

// Shorten /a/b/c/d/long/path/to/foo into /a/b/…/long/path/to/foo so
// both the prefix (which root) and the workspace name (suffix) survive.
function midEllipsize(p: string, max: number): string {
  if (p.length <= max) return p;
  const keep = max - 1; // 1 char for the ellipsis
  const tail = Math.floor(keep * 0.6);
  const head = keep - tail;
  return p.slice(0, head) + '…' + p.slice(p.length - tail);
}

function buildRows(env: Record<string, string>): Row[] {
  return Object.keys(env)
    .filter((k) => !INTERNAL_KEYS.has(k))
    .sort()
    .map((k) => ({ label: k, value: maskIfSecret(k, env[k]!) }));
}

export interface PreviewProps {
  workspace: Workspace | null;
}

export const Preview: React.FC<PreviewProps> = ({ workspace }) => {
  if (!workspace) return null;
  const rows = buildRows(workspace.env);
  const wsDir = dirname(workspace.envPath);
  const configDir = workspace.noIsolate
    ? tildeify((process.env.HOME ?? '') + '/.claude')
    : midEllipsize(tildeify(wsDir), PATH_MAX);

  if (rows.length === 0) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color={COLORS.lavender}>{'CLAUDE_CONFIG_DIR'.padEnd(20)}</Text>
          <Text color={COLORS.fg}>{configDir}</Text>
        </Box>
        <Box>
          <Text color={COLORS.red}>  (ccws.env empty or malformed)</Text>
        </Box>
      </Box>
    );
  }
  // Label column width is the wider of CLAUDE_CONFIG_DIR (18) and the
  // longest env key, +2 for breathing room.
  const labelWidth = Math.max(18, ...rows.map((r) => r.label.length)) + 2;
  return (
    <Box flexDirection="column">
      <Box>
        <Text color={COLORS.lavender} bold>{'CLAUDE_CONFIG_DIR'.padEnd(labelWidth)}</Text>
        <Text color={COLORS.fg}>{configDir}</Text>
      </Box>
      {rows.map((row) => (
        <Box key={row.label}>
          <Text color={COLORS.pink}>{row.label.padEnd(labelWidth)}</Text>
          <Text color={COLORS.fg}>{row.value}</Text>
        </Box>
      ))}
    </Box>
  );
};
