import React from 'react';
import { Box, Text } from 'ink';
import type { Workspace } from '../workspace.js';
import { PREVIEW_KEYS } from './previewKeys.js';
import { COLORS } from '../colors.js';

const TOKEN_LIKE = /_(TOKEN|AUTH|AUTH_TOKEN)$/;

// Internal metadata that is part of the workspace itself, not user config.
// CCWS_CREATED is exposed as "created" via PREVIEW_KEYS, so it's still shown
// — just don't double-print it under the catch-all section.
const INTERNAL_KEYS = new Set([
  'CCWS_NAME',
  'CCWS_CREATED',
  'CCWS_DESCRIPTION',
]);

interface Row {
  label: string;
  value: string;
}

function maskIfToken(envName: string, value: string): string {
  if (TOKEN_LIKE.test(envName) && value !== '') return '***';
  return value;
}

function buildRows(env: Record<string, string>): Row[] {
  const rows: Row[] = [];
  const seenLabels = new Set<string>();
  const consumedKeys = new Set<string>();

  // First pass: known keys in PREVIEW_KEYS order, with label dedup.
  for (const { env: envName, label } of PREVIEW_KEYS) {
    if (seenLabels.has(label)) {
      // Still mark as consumed so the catch-all doesn't reprint it.
      if (envName in env) consumedKeys.add(envName);
      continue;
    }
    if (!(envName in env)) continue;
    rows.push({ label, value: maskIfToken(envName, env[envName]!) });
    seenLabels.add(label);
    consumedKeys.add(envName);
  }

  // Second pass: any other env key the user added (sorted), excluding
  // internal metadata. Label = the env name verbatim (lowercased so it
  // visually groups with the known-key labels). Tokens still masked.
  const extras = Object.keys(env)
    .filter((k) => !consumedKeys.has(k) && !INTERNAL_KEYS.has(k))
    .sort();
  for (const k of extras) {
    rows.push({ label: k.toLowerCase(), value: maskIfToken(k, env[k]!) });
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
  const labelWidth = Math.max(14, ...rows.map((r) => r.label.length + 2));
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
