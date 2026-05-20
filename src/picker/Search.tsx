import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { COLORS } from '../colors.js';

export interface SearchProps {
  query: string;
  onChange: (value: string) => void;
  shown: number;
  total: number;
}

export const Search: React.FC<SearchProps> = ({ query, onChange, shown, total }) => {
  return (
    <Box>
      <Text color={COLORS.mauve}>{'› '}</Text>
      <TextInput value={query} onChange={onChange} />
      <Box flexGrow={1} />
      <Text color={COLORS.mauve}>{`${shown}/${total}`}</Text>
    </Box>
  );
};
