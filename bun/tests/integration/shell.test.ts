import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  existsSync,
  writeFileSync,
  copyFileSync,
  symlinkSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dirname, '../../..');
const BIN = join(REPO, 'bun/dist/ccws-host');
const INIT_SH = join(REPO, 'share/init.sh');

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

describe('shell + init.sh integration', () => {
  let tmp: string;

  beforeAll(() => {
    if (!existsSync(BIN)) {
      throw new Error(`Binary not built. Run: bun run build:host`);
    }
    if (!existsSync(INIT_SH)) {
      throw new Error(`share/init.sh not found at: ${INIT_SH}`);
    }
  });

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-shell-'));
    // tmp/bin/ccws — on PATH so bare `ccws` resolves (not needed by init.sh,
    // but keeps the env consistent and won't hurt).
    mkdirSync(join(tmp, 'bin'));
    symlinkSync(BIN, join(tmp, 'bin', 'ccws'));
    // tmp/repo/share/init.sh — init.sh derives CCWS_DIR as dirname(init.sh)/..
    // = tmp/repo, so the binary must also live at tmp/repo/bin/ccws.
    mkdirSync(join(tmp, 'repo', 'share'), { recursive: true });
    mkdirSync(join(tmp, 'repo', 'bin'), { recursive: true });
    copyFileSync(INIT_SH, join(tmp, 'repo', 'share', 'init.sh'));
    symlinkSync(BIN, join(tmp, 'repo', 'bin', 'ccws'));
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

  it('source init.sh; ccws list exits 0 and stderr says "no workspaces yet"', async () => {
    const initSh = join(tmp, 'repo', 'share', 'init.sh');
    const script = `source '${initSh}'; ccws list`;
    const r = await bash(script, baseEnv());
    expect(r.code).toBe(0);
    expect(r.stderr).toMatch(/no workspaces yet/);
  });

  it('ccws use work sets CCWS_NAME and ANTHROPIC_BASE_URL in the shell', async () => {
    // Create a workspace env file
    const wsDir = join(tmp, '.ccws', 'workspaces', 'work');
    mkdirSync(wsDir, { recursive: true });
    writeFileSync(
      join(wsDir, 'ccws.env'),
      'CCWS_NAME=work\nANTHROPIC_BASE_URL=https://api.x\n',
    );

    const initSh = join(tmp, 'repo', 'share', 'init.sh');
    const script = [
      `source '${initSh}'`,
      `ccws use work`,
      `printf 'name=%s url=%s\\n' "$CCWS_NAME" "$ANTHROPIC_BASE_URL"`,
    ].join('; ');

    const r = await bash(script, baseEnv());
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('name=work url=https://api.x');
  });

  it('ccws unset clears vars set by ccws use', async () => {
    // Create a workspace env file
    const wsDir = join(tmp, '.ccws', 'workspaces', 'work');
    mkdirSync(wsDir, { recursive: true });
    writeFileSync(
      join(wsDir, 'ccws.env'),
      'CCWS_NAME=work\nANTHROPIC_BASE_URL=https://api.x\n',
    );

    const initSh = join(tmp, 'repo', 'share', 'init.sh');
    const script = [
      `source '${initSh}'`,
      `ccws use work`,
      `ccws unset`,
      `printf '%s|%s' "\${CCWS_NAME:-(none)}" "\${ANTHROPIC_BASE_URL:-(none)}"`,
    ].join('; ');

    const r = await bash(script, baseEnv());
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('(none)|(none)');
  });
});
