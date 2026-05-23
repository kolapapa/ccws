import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { INIT_SH, INIT_FISH, CLAUDE_WRAPPER, SLASH_COMMANDS } from '../src/embedded.js';

async function bashEval(script: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const p = spawn('bash', ['-c', script]);
    let stdout = ''; let stderr = '';
    p.stdout.on('data', (c: Buffer) => { stdout += c.toString(); });
    p.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
    p.on('close', (code) => resolve({ stdout, stderr, code: code ?? 1 }));
  });
}

describe('embedded shell scripts', () => {
  describe('INIT_SH', () => {
    it('uses command ccws (not $CCWS_DIR/bin/ccws)', () => {
      expect(INIT_SH).toContain('command ccws');
      expect(INIT_SH).not.toContain('$CCWS_DIR/bin/ccws');
    });

    it('defines a ccws function', () => {
      expect(INIT_SH).toMatch(/^ccws\(\) \{/);
    });

    it('handles use / unset / "" / passthrough branches', () => {
      expect(INIT_SH).toMatch(/case "\$cmd" in/);
      expect(INIT_SH).toMatch(/\s+use\)/);
      expect(INIT_SH).toMatch(/\s+unset\)/);
      expect(INIT_SH).toMatch(/\s+""\)/);
      expect(INIT_SH).toMatch(/\s+\*\)/);
    });

    it('no-arg branch chains picker → use internally (calls command ccws use $picked)', () => {
      expect(INIT_SH).toMatch(/picked=\$\(command ccws\)/);
      expect(INIT_SH).toMatch(/exports=\$\(command ccws use "\$picked"\)/);
    });

    it('no-arg branch unsets stale vars before applying new exports (regression for repeated picker runs)', () => {
      // Without this, picking workspace A then workspace B leaves A's
      // exclusive env vars (e.g. HTTPS_PROXY) in the shell — they "cover"
      // subsequent picks because each workspace's ccws.env defines a
      // disjoint subset of keys. Mirror the `use)` branch's unset-first
      // pattern.
      const noArgBranch = INIT_SH.split('"")')[1]?.split('*)')[0] ?? '';
      expect(noArgBranch).toMatch(/unset_cmds=\$\(command ccws unset/);
      expect(noArgBranch.indexOf('command ccws unset'))
        .toBeLessThan(noArgBranch.indexOf('command ccws use'));
    });

    it('honors CCWS_DANGEROUS for claude launch flag', () => {
      expect(INIT_SH).toContain('CCWS_DANGEROUS');
      expect(INIT_SH).toContain('--dangerously-skip-permissions');
    });

    it('evaluates cleanly in bash (defines a ccws function callable in same shell)', async () => {
      const r = await bashEval(`${INIT_SH}\ntype ccws`);
      expect(r.code).toBe(0);
      expect(r.stdout).toMatch(/ccws is a function/);
    });
  });

  describe('INIT_FISH', () => {
    it('uses command ccws (not $CCWS_DIR/bin/ccws)', () => {
      expect(INIT_FISH).toContain('command ccws');
      expect(INIT_FISH).not.toContain('$CCWS_DIR/bin/ccws');
    });

    it('defines a ccws function with use / unset / no-arg / passthrough switch arms', () => {
      expect(INIT_FISH).toMatch(/^function ccws/);
      expect(INIT_FISH).toMatch(/switch "\$cmd"/);
      expect(INIT_FISH).toMatch(/case use/);
      expect(INIT_FISH).toMatch(/case unset/);
      expect(INIT_FISH).toMatch(/case ""/);
      expect(INIT_FISH).toMatch(/case '\*'/);
    });

    it('no-arg branch chains picker → use internally', () => {
      expect(INIT_FISH).toMatch(/picked \(command ccws\)/);
      expect(INIT_FISH).toMatch(/command ccws use \$picked/);
    });

    it('no-arg branch unsets stale vars before applying new exports (regression for repeated picker runs)', () => {
      const noArgBranch = INIT_FISH.split('case ""')[1]?.split("case '*'")[0] ?? '';
      expect(noArgBranch).toMatch(/command ccws unset/);
      expect(noArgBranch.indexOf('command ccws unset'))
        .toBeLessThan(noArgBranch.indexOf('command ccws use'));
    });
  });

  describe('CLAUDE_WRAPPER', () => {
    it('uses command ccws / command claude', () => {
      expect(CLAUDE_WRAPPER).toContain('command claude');
      expect(CLAUDE_WRAPPER).toContain('command ccws');
    });

    it('defines a claude function with CCWS_NAME fast-path', () => {
      expect(CLAUDE_WRAPPER).toMatch(/^claude\(\) \{/);
      expect(CLAUDE_WRAPPER).toContain('CCWS_NAME');
    });

    it('runs claude in a subshell after eval so parent env stays clean', () => {
      // Use a fully literal substring search to avoid regex escaping headaches.
      expect(CLAUDE_WRAPPER).toContain('eval "$exports"');
      expect(CLAUDE_WRAPPER.includes('(\n        eval')).toBe(true);
    });

    it('evaluates cleanly in bash', async () => {
      const r = await bashEval(`${CLAUDE_WRAPPER}\ntype claude`);
      expect(r.code).toBe(0);
      expect(r.stdout).toMatch(/claude is a function/);
    });
  });

  describe('SLASH_COMMANDS', () => {
    it('contains whoami.md and switch.md', () => {
      expect(Object.keys(SLASH_COMMANDS).sort()).toEqual(['switch.md', 'whoami.md']);
    });

    it('whoami prints workspace status', () => {
      expect(SLASH_COMMANDS['whoami.md']).toContain('CCWS_NAME');
      expect(SLASH_COMMANDS['whoami.md']).toContain('CLAUDE_CONFIG_DIR');
    });

    it('switch documents ccws use', () => {
      expect(SLASH_COMMANDS['switch.md']).toContain('ccws use');
      expect(SLASH_COMMANDS['switch.md']).toContain('ccws list');
    });
  });
});
