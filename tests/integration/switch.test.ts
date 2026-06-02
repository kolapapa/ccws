import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, rmSync, mkdirSync, existsSync, writeFileSync, readFileSync, symlinkSync, chmodSync,
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
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    p.stdout.on('data', (c: Buffer) => { out.push(c); });
    p.stderr.on('data', (c: Buffer) => { err.push(c); });
    p.on('error', reject);
    p.on('close', (code: number | null) => {
      resolve({ stdout: Buffer.concat(out).toString(), stderr: Buffer.concat(err).toString(), code: code ?? 1 });
    });
  });
}

describe('claude() wrapper account-switch relaunch', () => {
  let tmp: string;
  let claudeLog: string;

  beforeAll(() => {
    if (!existsSync(BIN)) throw new Error('Binary not built. Run: bun run build:host');
  });

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-switch-int-'));
    mkdirSync(join(tmp, 'bin'));
    symlinkSync(BIN, join(tmp, 'bin', 'ccws'));
    // Fake `claude` binary: records the args of each invocation, then exits.
    claudeLog = join(tmp, 'claude.log');
    const fake = join(tmp, 'bin', 'claude');
    writeFileSync(fake, `#!/usr/bin/env bash\necho "$@" >> "${claudeLog}"\n`);
    chmodSync(fake, 0o755);
    // A target workspace to switch into.
    const ws = join(tmp, '.ccws', 'workspaces', 'deepseek');
    mkdirSync(ws, { recursive: true });
    writeFileSync(join(ws, 'ccws.env'), 'CCWS_NAME=deepseek\nANTHROPIC_BASE_URL=https://api.deepseek\n');
  });

  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  function env(): Record<string, string> {
    return {
      PATH: `${join(tmp, 'bin')}:${process.env.PATH ?? ''}`,
      HOME: tmp,
      CCWS_ROOT: join(tmp, '.ccws'),
      CCWS_NAME: 'gradient',
    };
  }

  function marker(): string { return join(tmp, '.ccws', 'next-workspace'); }

  // One log line per claude invocation; drop the trailing '' from the final newline.
  // (Don't trim — a no-arg first launch legitimately logs an empty line.)
  function claudeArgs(): string[] {
    const lines = readFileSync(claudeLog, 'utf8').split('\n');
    lines.pop();
    return lines;
  }

  it('resumes the exact session under the new account, then consumes the marker', async () => {
    writeFileSync(marker(), 'deepseek\n439c89b1-abc\n');
    const script = `eval "$(ccws hook --shell bash --claude)"; claude`;
    const r = await bash(script, env());
    expect(r.code).toBe(0);
    const log = claudeArgs();
    // First launch (no args), then the relaunch under deepseek with --resume <id>.
    expect(log).toEqual(['', '--resume 439c89b1-abc']);
    expect(existsSync(marker())).toBe(false);
  });

  it('falls back to --continue when no session id was captured', async () => {
    writeFileSync(marker(), 'deepseek\n\n');
    const script = `eval "$(ccws hook --shell bash --claude)"; claude`;
    const r = await bash(script, env());
    expect(r.code).toBe(0);
    const log = claudeArgs();
    expect(log).toEqual(['', '--continue']);
  });

  it('does not relaunch when no switch is armed', async () => {
    const script = `eval "$(ccws hook --shell bash --claude)"; claude`;
    const r = await bash(script, env());
    expect(r.code).toBe(0);
    const log = claudeArgs();
    expect(log).toEqual(['']);
  });

  it('end-to-end: `ccws switch` arms the marker that the wrapper consumes', async () => {
    const script = [
      `eval "$(ccws hook --shell bash --claude)"`,
      `ccws switch deepseek session-xyz`,
      `claude`,
    ].join('; ');
    const r = await bash(script, env());
    expect(r.code).toBe(0);
    const log = claudeArgs();
    expect(log).toEqual(['', '--resume session-xyz']);
    expect(existsSync(marker())).toBe(false);
  });
});
