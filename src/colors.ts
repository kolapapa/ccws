// Catppuccin Mocha palette (subset used by ccws picker).
// Mirrors lib/tui.sh / lib/tui_fzf.sh / lib/tui_fallback.sh.
export const COLORS = {
  mauve:    '#cba6f7',
  pink:     '#f5c2e7',
  lavender: '#b4befe',
  sky:      '#89dceb',
  green:    '#a6e3a1',
  yellow:   '#f9e2af',
  red:      '#f38ba8',
  dim:      '#6c7086',
  fg:       '#cdd6f4',
} as const;

// 32-char horizontal divider, single source of truth.
// (Mirrors lib/tui.sh's CCWS_TUI_RULE.)
export const RULE = '────────────────────────────────';
