import { COLORS } from './colors.js';

// 6-line ANSI Shadow figlet rendering of "ccws".
// Identical to lib/tui.sh's CCWS_TUI_LOGO_LINES.
export const LOGO_LINES: readonly string[] = [
  ' ██████╗ ██████╗██╗    ██╗███████╗',
  '██╔════╝██╔════╝██║    ██║██╔════╝',
  '██║     ██║     ██║ █╗ ██║███████╗',
  '██║     ██║     ██║███╗██║╚════██║',
  '╚██████╗╚██████╗╚███╔███╔╝███████║',
  ' ╚═════╝ ╚═════╝ ╚══╝╚══╝ ╚══════╝',
] as const;

// Per-row gradient color, same order as bash CCWS_TUI_LOGO_COLORS.
export const LOGO_COLORS: readonly string[] = [
  COLORS.mauve,
  COLORS.pink,
  COLORS.lavender,
  COLORS.sky,
  COLORS.green,
  COLORS.yellow,
] as const;

// Logo width in cols (verified by chars in line 0).
export const LOGO_WIDTH = 34;

export interface LogoGateInputs {
  envNoLogo: string | undefined;     // process.env.CCWS_NO_LOGO
  stderrIsTTY: boolean;              // process.stderr.isTTY
  cols: number;                      // process.stdout.columns ?? 80
  lines: number;                     // process.stdout.rows ?? 24
  forceForTests?: boolean;           // bypass tty check (test only)
}

/**
 * Returns true iff all four logo gates pass.
 * Mirrors the bash ccws_tui_logo gate logic.
 */
export function shouldRenderLogo(inputs: LogoGateInputs): boolean {
  if (inputs.envNoLogo === '1') return false;
  if (!inputs.forceForTests && !inputs.stderrIsTTY) return false;
  if (inputs.cols < 36) return false;
  if (inputs.lines < 24) return false;
  return true;
}
