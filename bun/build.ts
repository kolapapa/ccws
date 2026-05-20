#!/usr/bin/env bun
import { copyFileSync, mkdirSync } from 'node:fs';

const TARGETS = [
  { triple: 'bun-darwin-arm64', os: 'darwin', arch: 'arm64' },
  { triple: 'bun-darwin-x64',   os: 'darwin', arch: 'x64' },
  { triple: 'bun-linux-arm64',  os: 'linux',  arch: 'arm64' },
  { triple: 'bun-linux-x64',    os: 'linux',  arch: 'x64' },
] as const;

async function buildOne(triple: string, out: string): Promise<boolean> {
  process.stdout.write(`building ${triple} → ${out}... `);
  const proc = Bun.spawn({
    cmd: ['bun', 'build', '--compile', '--target', triple, '--minify', 'src/index.ts', '--outfile', out],
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const code = await proc.exited;
  if (code === 0) { process.stdout.write('ok\n'); return true; }
  process.stdout.write(`FAILED (exit ${code})\n`);
  process.stderr.write(await new Response(proc.stderr).text());
  return false;
}

async function main(): Promise<void> {
  mkdirSync('dist', { recursive: true });
  let failed = 0;
  for (const { triple, os, arch } of TARGETS) {
    const platform = `${os}-${arch}`;
    const cliOut    = `dist/ccws-${platform}`;
    const pickerOut = `dist/ccws-picker-${platform}`;
    const ok = await buildOne(triple, cliOut);
    if (!ok) { failed++; continue; }
    copyFileSync(cliOut, pickerOut);
    process.stdout.write(`  copied → ${pickerOut}\n`);
  }
  if (failed > 0) {
    process.stderr.write(`\n${failed} target(s) failed\n`);
    process.exit(1);
  }
  process.stdout.write('\nall builds succeeded\n');
}

void main();
