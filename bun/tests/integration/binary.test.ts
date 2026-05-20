import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const BIN = join(dirname(fileURLToPath(import.meta.url)), '../../dist/ccws-host');

async function run(args: string[], env: Record<string, string>): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const p = spawn(BIN, args, { env: { PATH: process.env.PATH ?? '', ...env } });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    p.stdout.on('data', (chunk: Buffer) => { stdoutChunks.push(chunk); });
    p.stderr.on('data', (chunk: Buffer) => { stderrChunks.push(chunk); });
    p.on('error', reject);
    p.on('close', (code: number | null) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString(),
        stderr: Buffer.concat(stderrChunks).toString(),
        code: code ?? 1,
      });
    });
  });
}

describe('compiled binary', () => {
  let tmp: string;
  beforeAll(() => {
    if (!existsSync(BIN)) {
      throw new Error(`Binary not built. Run: bun build --compile --target=bun --minify src/index.ts --outfile dist/ccws-host`);
    }
  });
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-bin-'));
  });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('--version prints version', async () => {
    const r = await run(['--version'], { HOME: tmp });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^ccws \d+\.\d+\.\d+\n$/);
  });

  it('--help exits 0 and prints usage on stdout', async () => {
    const r = await run(['--help'], { HOME: tmp });
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/^ccws — /);
  });

  it('unknown command exits 2', async () => {
    const r = await run(['fake'], { HOME: tmp });
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/unknown command: fake/);
  });

  it('list returns 0 and "no workspaces yet" when CCWS_ROOT empty', async () => {
    const r = await run(['list'], { HOME: tmp, CCWS_ROOT: join(tmp, '.ccws') });
    expect(r.code).toBe(0);
    expect(r.stderr).toMatch(/no workspaces yet/);
  });

  it('add + use round-trip', async () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    const addRes = await run(['add', 'work', '--base-url', 'https://api.x', '--token', 'sk-1', '--non-interactive'], {
      HOME: tmp, CCWS_ROOT: join(tmp, '.ccws'), CCWS_REAL_CLAUDE_DIR: join(tmp, '.claude'),
    });
    expect(addRes.code).toBe(0);
    const useRes = await run(['use', 'work'], { HOME: tmp, CCWS_ROOT: join(tmp, '.ccws') });
    expect(useRes.code).toBe(0);
    expect(useRes.stdout).toContain(`export ANTHROPIC_BASE_URL='https://api.x'`);
    expect(useRes.stdout).toContain(`export ANTHROPIC_AUTH_TOKEN='sk-1'`);
  });

  it('which exits 1 when nothing resolves', async () => {
    const r = await run(['which'], { HOME: tmp, CCWS_ROOT: join(tmp, '.ccws') });
    expect(r.code).toBe(1);
  });

  it('hook --shell zsh emits an absolute source line', async () => {
    mkdirSync(join(tmp, 'src/share'), { recursive: true });
    writeFileSync(join(tmp, 'src/share/init.sh'), '');
    const r = await run(['hook', '--shell', 'zsh'], { HOME: tmp, CCWS_DIR: join(tmp, 'src') });
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe(`source '${join(tmp, 'src/share/init.sh')}'`);
  });
});
