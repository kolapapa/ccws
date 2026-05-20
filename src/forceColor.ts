// Side-effect-only module imported FIRST by index.ts.
//
// Bun's compiled binary + chalk's supports-color autodetection often disagrees
// in real terminals: `process.stderr.isTTY` can be `undefined` (not true) when
// the binary is spawned via shell wrapper / IDE / multiplexer, even though the
// terminal happily renders truecolor. The picker then renders flat white.
//
// We override with FORCE_COLOR=3 (24-bit) by default. The user can opt out
// with NO_COLOR=1 or pin a different level with FORCE_COLOR=0/1/2/3.
//
// References:
//   https://bixense.com/clicolors/   (CLICOLOR_FORCE / NO_COLOR conventions)
//   https://no-color.org/            (NO_COLOR spec)
if (process.env.FORCE_COLOR === undefined && process.env.NO_COLOR === undefined) {
  process.env.FORCE_COLOR = '3';
}
export {};
