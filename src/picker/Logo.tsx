import React from 'react';
import { Box, Text } from 'ink';
import { LOGO_LINES, LOGO_COLORS, shouldRenderLogo, type LogoGateInputs } from '../logoData.js';

export interface LogoProps {
  gate: LogoGateInputs;
}

export const Logo: React.FC<LogoProps> = ({ gate }) => {
  if (!shouldRenderLogo(gate)) return null;
  return (
    <Box flexDirection="column">
      {LOGO_LINES.map((line, i) => (
        <Text key={i} color={LOGO_COLORS[i]} bold>
          {line}
        </Text>
      ))}
    </Box>
  );
};
