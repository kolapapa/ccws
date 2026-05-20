import React from 'react';
import { Box, Text } from 'ink';
import type { Workspace } from '../workspace.js';
import { PREVIEW_KEYS } from './previewKeys.js';
import { COLORS } from '../colors.js';

const TOKEN_LIKE = /_(TOKEN|AUTH|AUTH_TOKEN)$/;

interface Row {
  label: string;
  value: string;
}

function buildRows(env: Record<string, string>): Row[] {
  const rows: Row[] = [];
  const seenLabels = new Set<string>();
  for (const { env: envName, label } of PREVIEW_KEYS) {
    if (seenLabels.has(label)) continue;
    if (!(envName in env)) continue;
    let value = env[envName]!;
    if (TOKEN_LIKE.test(envName) && value !== '') {
      value = '***';
    }
    rows.push({ label, value });
    seenLabels.add(label);
  }
  return rows;
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
  return (
    <Box flexDirection="column">
      {rows.map((row) => (
        <Box key={row.label}>
          <Text color={COLORS.pink}>{row.label.padEnd(14)}</Text>
          <Text color={COLORS.fg}>{row.value}</Text>
        </Box>
      ))}
    </Box>
  );
};
