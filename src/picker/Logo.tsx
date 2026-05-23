import React from 'react';
import { Static, Text } from 'ink';
import { LOGO_LINES, LOGO_COLORS, shouldRenderLogo, type LogoGateInputs } from '../logoData.js';

interface LogoItem {
  line: string;
  color: string;
  idx: number;
}

// Module-level constant — Ink's <Static> only writes items whose identity
// it hasn't seen before. Building this array inside the component would
// produce a new reference on every render and defeat the optimization.
const LOGO_ITEMS: LogoItem[] = LOGO_LINES.map((line, i) => ({
  line,
  color: LOGO_COLORS[i]!,
  idx: i,
}));

export interface LogoProps {
  gate: LogoGateInputs;
}

// Rendered via <Static> so the logo is written to the terminal once and
// then excluded from Ink's diff/redraw cycle. Without this, state changes
// (cursor moves, query edits) re-render the whole tree; when total content
// height exceeds terminal rows the resulting scroll leaves stale fragments
// of the logo's box-drawing characters in the visible region.
export const Logo: React.FC<LogoProps> = ({ gate }) => {
  if (!shouldRenderLogo(gate)) return null;
  return (
    <Static items={LOGO_ITEMS}>
      {(item) => (
        <Text key={item.idx} color={item.color} bold>
          {item.line}
        </Text>
      )}
    </Static>
  );
};
