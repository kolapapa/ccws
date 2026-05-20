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
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '../../dist/ccws-host');

async function bash(
  script: string,
  env: Record<string, string>,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const p = spawn('bash', ['-c', script], { env });
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

describe('shell + `ccws hook` integration', () => {
  let tmp: string;

  beforeAll(() => {
    if (!existsSync(BIN)) {
      throw new Error(`Binary not built. Run: bun run build:host`);
    }
  });

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-shell-'));
    mkdirSync(join(tmp, 'bin'));
    symlinkSync(BIN, join(tmp, 'bin', 'ccws'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function baseEnv(): Record<string, string> {
    return {
      PATH: `${join(tmp, 'bin')}:${process.env.PATH ?? ''}`,
      HOME: tmp,
      CCWS_ROOT: join(tmp, '.ccws'),
    };
  }

  // The v1.0 install flow: user's rc does `eval "$(ccws hook --shell bash)"`
  // which loads the embedded ccws() function. All wrapper logic now ships
  // inside the binary — no disk-side share/ files involved.
  it('eval "$(ccws hook --shell bash)"; ccws list — no workspaces case', async () => {
    const script = `eval "$(ccws hook --shell bash)"; ccws list`;
    const r = await bash(script, baseEnv());
    expect(r.code).toBe(0);
    expect(r.stderr).toMatch(/no workspaces yet/);
  });

  it('ccws use work sets CCWS_NAME and ANTHROPIC_BASE_URL in the shell', async () => {
    const wsDir = join(tmp, '.ccws', 'workspaces', 'work');
    mkdirSync(wsDir, { recursive: true });
    writeFileSync(
      join(wsDir, 'ccws.env'),
      'CCWS_NAME=work\nANTHROPIC_BASE_URL=https://api.x\n',
    );

    const script = [
      `eval "$(ccws hook --shell bash)"`,
      `ccws use work`,
      `printf 'name=%s url=%s\\n' "$CCWS_NAME" "$ANTHROPIC_BASE_URL"`,
    ].join('; ');

    const r = await bash(script, baseEnv());
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('name=work url=https://api.x');
  });

  it('ccws unset clears vars set by ccws use', async () => {
    const wsDir = join(tmp, '.ccws', 'workspaces', 'work');
    mkdirSync(wsDir, { recursive: true });
    writeFileSync(
      join(wsDir, 'ccws.env'),
      'CCWS_NAME=work\nANTHROPIC_BASE_URL=https://api.x\n',
    );

    const script = [
      `eval "$(ccws hook --shell bash)"`,
      `ccws use work`,
      `ccws unset`,
      `printf '%s|%s' "\${CCWS_NAME:-(none)}" "\${ANTHROPIC_BASE_URL:-(none)}"`,
    ].join('; ');

    const r = await bash(script, baseEnv());
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('(none)|(none)');
  });
});
