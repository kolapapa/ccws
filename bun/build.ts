#!/usr/bin/env bun
import { mkdirSync } from 'node:fs';

const TARGETS = [
  { triple: 'bun-darwin-arm64', out: 'dist/ccws-picker-darwin-arm64' },
  { triple: 'bun-darwin-x64',   out: 'dist/ccws-picker-darwin-x64' },
  { triple: 'bun-linux-arm64',  out: 'dist/ccws-picker-linux-arm64' },
  { triple: 'bun-linux-x64',    out: 'dist/ccws-picker-linux-x64' },
] as const;

async function main(): Promise<void> {
  mkdirSync('dist', { recursive: true });
  let failed = 0;
  for (const { triple, out } of TARGETS) {
    process.stdout.write(`building ${triple} → ${out}... `);
    const proc = Bun.spawn({
      cmd: [
        'bun', 'build', '--compile',
        '--target', triple,
        '--minify',
        'src/index.ts',
        '--outfile', out,
      ],
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const code = await proc.exited;
    if (code === 0) {
      process.stdout.write('ok\n');
    } else {
      process.stdout.write(`FAILED (exit ${code})\n`);
      process.stderr.write(await new Response(proc.stderr).text());
      failed++;
    }
  }
  if (failed > 0) {
    process.stderr.write(`\n${failed} target(s) failed\n`);
    process.exit(1);
  }
  process.stdout.write('\nall builds succeeded\n');
}

void main();
