import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  existsSync,
  writeFileSync,
  symlinkSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '../../dist/ccws-host');

async function fishCmd(
  script: string,
  env: Record<string, string>,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const p = spawn('fish', ['-c', script], { env });
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

const fishInstalled = spawnSync('fish', ['--version']).status === 0;

describe.skipIf(!fishInstalled)('fish + `ccws hook` integration', () => {
  let tmp: string;

  beforeAll(() => {
    if (!existsSync(BIN)) {
      throw new Error(`Binary not built. Run: bun run build:host`);
    }
  });

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-fish-'));
    mkdirSync(join(tmp, 'bin'));
    symlinkSync(BIN, join(tmp, 'bin', 'ccws'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('ccws hook --shell fish | source; ccws use sets the vars', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/work'), { recursive: true });
    writeFileSync(
      join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nANTHROPIC_BASE_URL=https://api.x\n',
    );
    const r = await fishCmd(
      `ccws hook --shell fish | source; ccws use work; printf 'name=%s url=%s\\n' "$CCWS_NAME" "$ANTHROPIC_BASE_URL"`,
      { HOME: tmp, CCWS_ROOT: join(tmp, '.ccws'), PATH: `${tmp}/bin:${process.env.PATH ?? ''}` },
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('name=work url=https://api.x');
  });
});
