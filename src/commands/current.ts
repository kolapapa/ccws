import { wsDir } from '../paths.js';

export async function runCurrent(argv: string[]): Promise<number> {
  const pathOnly = argv[0] === '--path' || argv[0] === '-p';
  const name = process.env.CCWS_NAME ?? '';
  if (name === '') {
    if (pathOnly) return 1;
    process.stdout.write('(none) — run "ccws use <name>" to activate\n');
    return 0;
  }
  if (pathOnly) {
    process.stdout.write(`${wsDir(name)}\n`);
  } else {
    process.stdout.write(`${name} (CLAUDE_CONFIG_DIR=${process.env.CLAUDE_CONFIG_DIR ?? ''})\n`);
  }
  return 0;
}
