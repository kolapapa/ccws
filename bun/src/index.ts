#!/usr/bin/env bun
import { dispatch, PICKER_SENTINEL } from './cli.js';
import { runPicker } from './commands/picker.js';

async function main(): Promise<void> {
  const code = await dispatch(process.argv.slice(2));
  if (code === PICKER_SENTINEL) {
    process.exit(await runPicker());
  }
  process.exit(code);
}

void main();
