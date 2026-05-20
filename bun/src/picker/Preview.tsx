import React from 'react';
import { Box, Text } from 'ink';
import type { Workspace } from '../workspace.js';
import { COLORS } from '../colors.js';

const TOKEN_LIKE = /(_TOKEN|_AUTH|_AUTH_TOKEN|_KEY)$/i;

// Workspace identity — handled elsewhere in the picker / row, don't repeat
// in the preview. CCWS_NAME shows in the row, CCWS_DANGEROUS shows as the
// yolo/safe glyph. Everything else the user wrote in ccws.env shows here
// verbatim.
const INTERNAL_KEYS = new Set(['CCWS_NAME', 'CCWS_DANGEROUS']);

interface Row {
  label: string;
  value: string;
}

function maskIfSecret(envName: string, value: string): string {
  if (TOKEN_LIKE.test(envName) && value !== '') return '***';
  return value;
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
  if (rows.length === 0) {
    return (
      <Box>
        <Text color={COLORS.red}>  (ccws.env empty or malformed)</Text>
      </Box>
    );
  }
  const labelWidth = Math.max(...rows.map((r) => r.label.length)) + 2;
  return (
    <Box flexDirection="column">
      {rows.map((row) => (
        <Box key={row.label}>
          <Text color={COLORS.pink}>{row.label.padEnd(labelWidth)}</Text>
          <Text color={COLORS.fg}>{row.value}</Text>
        </Box>
      ))}
    </Box>
  );
};
