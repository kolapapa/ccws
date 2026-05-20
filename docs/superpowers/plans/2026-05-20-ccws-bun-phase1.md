# ccws Bun Rewrite — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. WORKTREE setup is Task 1 of this plan — if the execution skill creates one via `superpowers:using-git-worktrees`, Task 1 becomes a verification step instead.

**Goal:** Ship a compiled `ccws-picker` binary (Bun + Ink TUI) that bash's `lib/tui.sh` invokes when present, with the existing fzf/fallback path retained for users who haven't installed the binary yet. Includes a cross-platform release pipeline.

**Architecture:** New TypeScript code lives in a `bun/` subdirectory of the repo. Ink (React-on-terminal) handles the picker UI; React state keyed by workspace name lets the cursor stick across `Tab` toggle reloads — the hard problem that fzf bind syntax couldn't solve. The binary is one-shot: read `~/.ccws/workspaces/`, render picker, write selected workspace name to stdout, exit. Persisted state (`CCWS_DANGEROUS=1`) lives in the workspace's `ccws.env`, so the existing bash export pipeline is unchanged.

**Tech Stack:** Bun 1.x runtime + `bun build --compile`; Ink 5 + React 18 for TUI; `ink-text-input` for filter input; vitest + ink-testing-library for tests; GitHub Actions for cross-platform release.

**Spec reference:** `docs/superpowers/specs/2026-05-20-ccws-bun-rewrite-design.md` (commit `5871329`).

---

## File Structure

| Path | Responsibility | Action |
|------|----------------|--------|
| `bun/package.json` | npm-compatible manifest, deps, scripts | Create |
| `bun/tsconfig.json` | TS strict config + JSX for Ink | Create |
| `bun/bunfig.toml` | Bun-specific config (test runner) | Create |
| `bun/.gitignore` | Ignore `dist/`, `node_modules/` | Create |
| `bun/README.md` | How to build, dev, test | Create |
| `bun/build.ts` | Driver: cross-compile 4 targets | Create |
| `bun/src/env.ts` | `parseEnvFile`, `setEnvKey`, `unsetEnvKey` | Create |
| `bun/src/workspace.ts` | Scan `~/.ccws/workspaces/`, build `Workspace[]` | Create |
| `bun/src/colors.ts` | Catppuccin Mocha palette + hex consts | Create |
| `bun/src/logoData.ts` | 6 logo lines + gradient color array | Create |
| `bun/src/picker/previewKeys.ts` | Ordered env→label list (mirror of bash `CCWS_PREVIEW_KEYS`) | Create |
| `bun/src/picker/state.ts` | Reducer + actions: setQuery, setCursor, toggleDangerous | Create |
| `bun/src/picker/Logo.tsx` | 6-row gradient Ink component, env-gated | Create |
| `bun/src/picker/Search.tsx` | Text input row with `›` prompt | Create |
| `bun/src/picker/Row.tsx` | Single workspace row, columns + active marker | Create |
| `bun/src/picker/List.tsx` | Scrolling list, cursor highlight | Create |
| `bun/src/picker/Preview.tsx` | Key/value preview pane | Create |
| `bun/src/picker/App.tsx` | Composition + `useInput` keymap | Create |
| `bun/src/index.ts` | Phase 1 entry: render `<App />`, emit selection on exit | Create |
| `bun/tests/env.test.ts` | Parser round-trip + setEnvKey/unsetEnvKey | Create |
| `bun/tests/workspace.test.ts` | Scanner with fixture tree | Create |
| `bun/tests/state.test.ts` | Reducer transitions | Create |
| `bun/tests/logo.test.tsx` | Logo gating (CCWS_NO_LOGO, cols<36, lines<24) | Create |
| `bun/tests/picker.test.tsx` | App integration: type, tab, enter, esc | Create |
| `bun/tests/fixtures/workspaces/` | Mock workspace tree | Create |
| `lib/tui.sh` | Add binary-detection prelude to `ccws_tui_run` | Modify |
| `tests/integration/tui.bats` | Add bridge tests | Modify |
| `.github/workflows/test.yml` | Add bun test job | Modify (or create if absent) |
| `.github/workflows/release.yml` | Cross-compile + upload binaries on tag | Create (or modify if exists) |
| `DESIGN.md` | Add "Bun rewrite architecture" section | Modify |

---

## Task 1: Worktree setup + bun project scaffold

**Files:**
- Create worktree: `~/workspace/ccws-bun` on branch `spec/bun-rewrite`
- Create: `bun/package.json`, `bun/tsconfig.json`, `bun/bunfig.toml`, `bun/.gitignore`, `bun/README.md`

- [ ] **Step 1: Create the git worktree**

```bash
cd /Users/kola/workspace/ccws
git worktree add ../ccws-bun -b spec/bun-rewrite
cd ../ccws-bun
git status
```

Expected: clean tree, on branch `spec/bun-rewrite`, ahead 0 / behind 0 of origin (or wherever `spec/tui-ascii-logo` was — branch is created off whatever HEAD was).

- [ ] **Step 2: Verify Bun is installed**

```bash
bun --version
```

Expected: a version string like `1.1.x` or `1.2.x`. If absent: `curl -fsSL https://bun.sh/install | bash`.

- [ ] **Step 3: Create `bun/package.json`**

```json
{
  "name": "ccws-picker",
  "version": "0.7.0",
  "description": "TUI picker for ccws — Phase 1 of the Bun rewrite",
  "type": "module",
  "scripts": {
    "dev": "bun run src/index.ts",
    "build": "bun run build.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "ink": "^5.0.0",
    "ink-text-input": "^6.0.0",
    "react": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "ink-testing-library": "^4.0.0",
    "typescript": "^5.4.0",
    "vitest": "^2.0.0"
  },
  "engines": {
    "bun": ">=1.1.0"
  }
}
```

- [ ] **Step 4: Create `bun/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "types": ["bun-types"],
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*", "tests/**/*", "build.ts"]
}
```

- [ ] **Step 5: Create `bun/bunfig.toml`**

```toml
[test]
preload = []
```

(Minimal — just present so Bun knows it's a Bun project. Vitest does the actual test running because ink-testing-library targets vitest/jest, not `bun test`.)

- [ ] **Step 6: Create `bun/.gitignore`**

```
node_modules/
dist/
*.log
.DS_Store
```

- [ ] **Step 7: Create `bun/README.md`**

```markdown
# ccws Bun rewrite (Phase 1)

TUI picker for ccws. Compiled binary that the bash `ccws_tui_run`
invokes when present. fzf remains a fallback for users who haven't
installed the binary yet.

## Dev

    bun install
    bun run dev       # run the picker against ~/.ccws/workspaces/
    bun run test      # vitest
    bun run typecheck # tsc --noEmit

## Build

    bun run build     # produces dist/ccws-picker-<platform> for 4 targets

See `../docs/superpowers/specs/2026-05-20-ccws-bun-rewrite-design.md`
for the full design and phasing plan.
```

- [ ] **Step 8: Install deps**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun install
```

Expected: a `bun.lockb` file appears + `node_modules/` populated. No errors.

- [ ] **Step 9: Verify typecheck on empty source**

```bash
mkdir -p src
echo 'export {};' > src/index.ts
bun run typecheck
```

Expected: exit 0, no output.

- [ ] **Step 10: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add bun/package.json bun/tsconfig.json bun/bunfig.toml bun/.gitignore bun/README.md bun/bun.lockb bun/src/index.ts
git commit -m "chore(bun): scaffold Bun + Ink + vitest project under bun/

Phase 1 of the Bun rewrite per docs/superpowers/specs/2026-05-20-ccws-bun-rewrite-design.md.
This commit just sets up the build/test infrastructure — no picker code yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: ccws.env parser (`bun/src/env.ts`)

**Files:**
- Create: `bun/src/env.ts`
- Create: `bun/tests/env.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `bun/tests/env.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnvFile, setEnvKey, unsetEnvKey } from '../src/env.js';

let tmp: string;
let envPath: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ccws-env-'));
  envPath = join(tmp, 'ccws.env');
});

describe('parseEnvFile', () => {
  it('parses KEY=value lines into a record', () => {
    writeFileSync(envPath, 'ANTHROPIC_BASE_URL=https://api.anthropic.com\nCCWS_NAME=work\n');
    expect(parseEnvFile(envPath)).toEqual({
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      CCWS_NAME: 'work',
    });
  });

  it('skips comments and blank lines', () => {
    writeFileSync(envPath, '# header comment\n\nANTHROPIC_BASE_URL=x\n# trailing comment\n');
    expect(parseEnvFile(envPath)).toEqual({ ANTHROPIC_BASE_URL: 'x' });
  });

  it('skips lines with invalid keys', () => {
    writeFileSync(envPath, '1BADKEY=x\nGOOD_KEY=y\nKEY WITH SPACE=z\nGOOD_KEY2=ok\n');
    expect(parseEnvFile(envPath)).toEqual({ GOOD_KEY: 'y', GOOD_KEY2: 'ok' });
  });

  it('preserves = inside values (only splits on first =)', () => {
    writeFileSync(envPath, 'TOKEN=abc=def=ghi\n');
    expect(parseEnvFile(envPath)).toEqual({ TOKEN: 'abc=def=ghi' });
  });

  it('returns empty object when file does not exist', () => {
    expect(parseEnvFile(join(tmp, 'missing.env'))).toEqual({});
  });

  it('last duplicate wins (matches bash semantics)', () => {
    writeFileSync(envPath, 'K=first\nK=second\nK=third\n');
    expect(parseEnvFile(envPath)).toEqual({ K: 'third' });
  });
});

describe('setEnvKey', () => {
  it('appends when key does not exist', () => {
    writeFileSync(envPath, 'EXISTING=1\n');
    setEnvKey(envPath, 'CCWS_DANGEROUS', '1');
    expect(readFileSync(envPath, 'utf8')).toBe('EXISTING=1\nCCWS_DANGEROUS=1\n');
  });

  it('replaces existing key in place', () => {
    writeFileSync(envPath, 'A=1\nCCWS_DANGEROUS=0\nB=2\n');
    setEnvKey(envPath, 'CCWS_DANGEROUS', '1');
    expect(readFileSync(envPath, 'utf8')).toBe('A=1\nCCWS_DANGEROUS=1\nB=2\n');
  });

  it('preserves comments and blank lines on replace', () => {
    writeFileSync(envPath, '# header\n\nCCWS_DANGEROUS=0\n# tail\n');
    setEnvKey(envPath, 'CCWS_DANGEROUS', '1');
    expect(readFileSync(envPath, 'utf8')).toBe('# header\n\nCCWS_DANGEROUS=1\n# tail\n');
  });

  it('rejects invalid key', () => {
    writeFileSync(envPath, '');
    expect(() => setEnvKey(envPath, '1BAD', '1')).toThrow();
  });
});

describe('unsetEnvKey', () => {
  it('removes the matching line', () => {
    writeFileSync(envPath, 'A=1\nCCWS_DANGEROUS=1\nB=2\n');
    unsetEnvKey(envPath, 'CCWS_DANGEROUS');
    expect(readFileSync(envPath, 'utf8')).toBe('A=1\nB=2\n');
  });

  it('no-op when key absent', () => {
    writeFileSync(envPath, 'A=1\nB=2\n');
    unsetEnvKey(envPath, 'CCWS_DANGEROUS');
    expect(readFileSync(envPath, 'utf8')).toBe('A=1\nB=2\n');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test env
```

Expected: all tests fail with "Cannot find module '../src/env.js'".

- [ ] **Step 3: Implement `bun/src/env.ts`**

```typescript
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function isValidKey(key: string): boolean {
  return KEY_RE.test(key);
}

export function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const text = readFileSync(path, 'utf8');
  const out: Record<string, string> = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq);
    const value = line.slice(eq + 1);
    if (!isValidKey(key)) continue;
    out[key] = value;
  }
  return out;
}

export function setEnvKey(path: string, key: string, value: string): void {
  if (!isValidKey(key)) throw new Error(`invalid env key: ${key}`);
  const text = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const lines = text.split('\n');
  let replaced = false;
  const updated = lines.map((line) => {
    if (replaced) return line;
    const eq = line.indexOf('=');
    if (eq < 0) return line;
    if (line.slice(0, eq) !== key) return line;
    replaced = true;
    return `${key}=${value}`;
  });
  let final = updated.join('\n');
  if (!replaced) {
    // Append. Preserve trailing newline convention: if file ended with \n,
    // append on a new line; otherwise add a separator.
    if (final.endsWith('\n') || final === '') {
      final += `${key}=${value}\n`;
    } else {
      final += `\n${key}=${value}\n`;
    }
  }
  writeFileSync(path, final);
}

export function unsetEnvKey(path: string, key: string): void {
  if (!isValidKey(key)) throw new Error(`invalid env key: ${key}`);
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  const lines = text.split('\n');
  const kept = lines.filter((line) => {
    const eq = line.indexOf('=');
    if (eq < 0) return true;
    return line.slice(0, eq) !== key;
  });
  writeFileSync(path, kept.join('\n'));
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test env
```

Expected: all env tests pass (16+).

- [ ] **Step 5: Run typecheck**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run typecheck
```

Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add bun/src/env.ts bun/tests/env.test.ts
git commit -m "feat(bun): ccws.env parser + setEnvKey/unsetEnvKey

Pure read+write helpers for the workspace env file. Matches bash
semantics: invalid keys skipped, first '=' splits, last duplicate
wins, comments + blank lines round-trip preserved across set/unset.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Workspace scanner (`bun/src/workspace.ts`)

**Files:**
- Create: `bun/src/workspace.ts`
- Create: `bun/tests/workspace.test.ts`
- Create: `bun/tests/fixtures/workspaces/` (mock tree)

- [ ] **Step 1: Build the fixture workspace tree**

```bash
cd /Users/kola/workspace/ccws-bun/bun
mkdir -p tests/fixtures/workspaces/work
mkdir -p tests/fixtures/workspaces/proxied
mkdir -p tests/fixtures/workspaces/danger-ws

cat > tests/fixtures/workspaces/work/ccws.env <<'EOF'
ANTHROPIC_BASE_URL=https://api.anthropic.com
ANTHROPIC_AUTH_TOKEN=secret-work-token
CCWS_CREATED=2026-01-01T00:00:00Z
EOF

cat > tests/fixtures/workspaces/proxied/ccws.env <<'EOF'
ANTHROPIC_BASE_URL=https://api.anthropic.com
HTTPS_PROXY=http://127.0.0.1:7890
http_proxy=http://127.0.0.1:7890
CCWS_CREATED=2026-02-01T00:00:00Z
EOF

cat > tests/fixtures/workspaces/danger-ws/ccws.env <<'EOF'
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
CCWS_DANGEROUS=1
CCWS_CREATED=2026-03-01T00:00:00Z
EOF
```

- [ ] **Step 2: Write the failing tests**

Create `bun/tests/workspace.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scanWorkspaces } from '../src/workspace.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'workspaces');

describe('scanWorkspaces', () => {
  it('lists all workspace directories with metadata', () => {
    const ws = scanWorkspaces({ workspacesDir: FIXTURES, activeName: null });
    const names = ws.map((w) => w.name).sort();
    expect(names).toEqual(['danger-ws', 'proxied', 'work']);
  });

  it('detects proxy when HTTPS_PROXY / http_proxy / etc. is set', () => {
    const ws = scanWorkspaces({ workspacesDir: FIXTURES, activeName: null });
    expect(ws.find((w) => w.name === 'proxied')!.proxy).toBe(true);
    expect(ws.find((w) => w.name === 'work')!.proxy).toBe(false);
  });

  it('detects dangerous when CCWS_DANGEROUS=1', () => {
    const ws = scanWorkspaces({ workspacesDir: FIXTURES, activeName: null });
    expect(ws.find((w) => w.name === 'danger-ws')!.dangerous).toBe(true);
    expect(ws.find((w) => w.name === 'work')!.dangerous).toBe(false);
  });

  it('marks active workspace when activeName matches', () => {
    const ws = scanWorkspaces({ workspacesDir: FIXTURES, activeName: 'work' });
    expect(ws.find((w) => w.name === 'work')!.active).toBe(true);
    expect(ws.find((w) => w.name === 'proxied')!.active).toBe(false);
  });

  it('returns empty array when workspacesDir does not exist', () => {
    expect(scanWorkspaces({ workspacesDir: '/nonexistent/path', activeName: null })).toEqual([]);
  });

  it('exposes parsed env for preview consumption', () => {
    const ws = scanWorkspaces({ workspacesDir: FIXTURES, activeName: null });
    const proxied = ws.find((w) => w.name === 'proxied')!;
    expect(proxied.env.HTTPS_PROXY).toBe('http://127.0.0.1:7890');
  });

  it('endpoint falls back to "anthropic" when ANTHROPIC_BASE_URL missing', () => {
    // Create a workspace without ANTHROPIC_BASE_URL on the fly
    const { mkdtempSync, writeFileSync, mkdirSync } = require('node:fs') as typeof import('node:fs');
    const { tmpdir } = require('node:os') as typeof import('node:os');
    const tmp = mkdtempSync(join(tmpdir(), 'ccws-noend-'));
    mkdirSync(join(tmp, 'bare'));
    writeFileSync(join(tmp, 'bare', 'ccws.env'), 'CCWS_CREATED=2026-01-01\n');
    const ws = scanWorkspaces({ workspacesDir: tmp, activeName: null });
    expect(ws[0]!.endpoint).toBe('anthropic');
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test workspace
```

Expected: all fail with "Cannot find module '../src/workspace.js'".

- [ ] **Step 4: Implement `bun/src/workspace.ts`**

```typescript
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnvFile } from './env.js';

const PROXY_KEYS = [
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'ALL_PROXY',
  'https_proxy',
  'http_proxy',
  'all_proxy',
];

export interface Workspace {
  name: string;
  endpoint: string;
  proxy: boolean;
  dangerous: boolean;
  active: boolean;
  envPath: string;
  env: Record<string, string>;
  mtime: number;
}

export interface ScanOptions {
  workspacesDir: string;
  activeName: string | null;
}

export function scanWorkspaces(opts: ScanOptions): Workspace[] {
  const { workspacesDir, activeName } = opts;
  if (!existsSync(workspacesDir)) return [];
  const entries = readdirSync(workspacesDir);
  const out: Workspace[] = [];
  for (const name of entries) {
    const wsDir = join(workspacesDir, name);
    let st;
    try {
      st = statSync(wsDir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const envPath = join(wsDir, 'ccws.env');
    const env = parseEnvFile(envPath);
    const proxy = PROXY_KEYS.some((k) => k in env);
    const dangerous = env.CCWS_DANGEROUS === '1';
    const endpoint = env.ANTHROPIC_BASE_URL || 'anthropic';
    out.push({
      name,
      endpoint,
      proxy,
      dangerous,
      active: activeName === name,
      envPath,
      env,
      mtime: st.mtimeMs,
    });
  }
  return out;
}

export function defaultWorkspacesDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return join(home, '.ccws', 'workspaces');
}
```

- [ ] **Step 5: Run tests, verify they pass**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test workspace
```

Expected: all 7 tests pass.

- [ ] **Step 6: Run typecheck**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run typecheck
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add bun/src/workspace.ts bun/tests/workspace.test.ts bun/tests/fixtures/
git commit -m "feat(bun): workspace scanner

Reads ~/.ccws/workspaces/, returns Workspace[] with name + endpoint +
proxy + dangerous + active + parsed env. Mirrors bash
ccws_tui_collect_workspaces semantics: proxy detected via any of 6
proxy var names, dangerous via CCWS_DANGEROUS=1, endpoint falls back
to 'anthropic' when ANTHROPIC_BASE_URL is absent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Colors + logo data (`bun/src/colors.ts`, `bun/src/logoData.ts`)

**Files:**
- Create: `bun/src/colors.ts`
- Create: `bun/src/logoData.ts`

This task has no failing-test driver; it's pure data constants. We snapshot via the upcoming logo test (Task 5).

- [ ] **Step 1: Create `bun/src/colors.ts`**

```typescript
// Catppuccin Mocha palette (subset used by ccws picker).
// Mirrors lib/tui.sh / lib/tui_fzf.sh / lib/tui_fallback.sh.
export const COLORS = {
  mauve:    '#cba6f7',
  pink:     '#f5c2e7',
  lavender: '#b4befe',
  sky:      '#89dceb',
  green:    '#a6e3a1',
  yellow:   '#f9e2af',
  red:      '#f38ba8',
  dim:      '#6c7086',
  fg:       '#cdd6f4',
} as const;

// 32-char horizontal divider, single source of truth.
// (Mirrors lib/tui.sh's CCWS_TUI_RULE.)
export const RULE = '────────────────────────────────';
```

- [ ] **Step 2: Create `bun/src/logoData.ts`**

```typescript
import { COLORS } from './colors.js';

// 6-line ANSI Shadow figlet rendering of "ccws".
// Identical to lib/tui.sh's CCWS_TUI_LOGO_LINES.
export const LOGO_LINES: readonly string[] = [
  ' ██████╗ ██████╗██╗    ██╗███████╗',
  '██╔════╝██╔════╝██║    ██║██╔════╝',
  '██║     ██║     ██║ █╗ ██║███████╗',
  '██║     ██║     ██║███╗██║╚════██║',
  '╚██████╗╚██████╗╚███╔███╔╝███████║',
  ' ╚═════╝ ╚═════╝ ╚══╝╚══╝ ╚══════╝',
] as const;

// Per-row gradient color, same order as bash CCWS_TUI_LOGO_COLORS.
export const LOGO_COLORS: readonly string[] = [
  COLORS.mauve,
  COLORS.pink,
  COLORS.lavender,
  COLORS.sky,
  COLORS.green,
  COLORS.yellow,
] as const;

// Logo width in cols (verified by chars in line 0).
export const LOGO_WIDTH = 34;

export interface LogoGateInputs {
  envNoLogo: string | undefined;     // process.env.CCWS_NO_LOGO
  stderrIsTTY: boolean;              // process.stderr.isTTY
  cols: number;                      // process.stdout.columns ?? 80
  lines: number;                     // process.stdout.rows ?? 24
  forceForTests?: boolean;           // bypass tty check (test only)
}

/**
 * Returns true iff all four logo gates pass.
 * Mirrors the bash ccws_tui_logo gate logic.
 */
export function shouldRenderLogo(inputs: LogoGateInputs): boolean {
  if (inputs.envNoLogo === '1') return false;
  if (!inputs.forceForTests && !inputs.stderrIsTTY) return false;
  if (inputs.cols < 36) return false;
  if (inputs.lines < 24) return false;
  return true;
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add bun/src/colors.ts bun/src/logoData.ts
git commit -m "feat(bun): Catppuccin palette + logo data + gate logic

Constants only — Ink components in the next tasks consume these.
shouldRenderLogo() mirrors the bash gate chain (CCWS_NO_LOGO,
non-tty, cols<36, lines<24). forceForTests is the TS equivalent of
bash CCWS_TUI_LOGO_FORCE — bypasses the tty check only.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Logo component + gate tests (`bun/src/picker/Logo.tsx`)

**Files:**
- Create: `bun/src/picker/Logo.tsx`
- Create: `bun/tests/logo.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `bun/tests/logo.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Logo } from '../src/picker/Logo.js';

const pass = {
  envNoLogo: undefined,
  stderrIsTTY: true,
  cols: 80,
  lines: 40,
  forceForTests: true,
} as const;

describe('Logo', () => {
  it('renders 6 logo lines when all gates pass', () => {
    const { lastFrame } = render(<Logo gate={pass} />);
    const frame = lastFrame() ?? '';
    // Each logo line contains box-drawing blocks (█ or ═) — count rows.
    const logoRows = frame.split('\n').filter((row) => /[█═]/.test(row));
    expect(logoRows.length).toBeGreaterThanOrEqual(6);
  });

  it('renders nothing when CCWS_NO_LOGO=1', () => {
    const { lastFrame } = render(<Logo gate={{ ...pass, envNoLogo: '1' }} />);
    expect(lastFrame() ?? '').not.toMatch(/█/);
  });

  it('renders nothing when cols<36', () => {
    const { lastFrame } = render(<Logo gate={{ ...pass, cols: 30 }} />);
    expect(lastFrame() ?? '').not.toMatch(/█/);
  });

  it('renders nothing when lines<24', () => {
    const { lastFrame } = render(<Logo gate={{ ...pass, lines: 20 }} />);
    expect(lastFrame() ?? '').not.toMatch(/█/);
  });

  it('renders nothing when stderr is not a tty and force is off', () => {
    const { lastFrame } = render(<Logo gate={{ ...pass, stderrIsTTY: false, forceForTests: false }} />);
    expect(lastFrame() ?? '').not.toMatch(/█/);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test logo
```

Expected: 5 failures, "Cannot find module".

- [ ] **Step 3: Implement `bun/src/picker/Logo.tsx`**

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import { LOGO_LINES, LOGO_COLORS, shouldRenderLogo, type LogoGateInputs } from '../logoData.js';

export interface LogoProps {
  gate: LogoGateInputs;
}

export const Logo: React.FC<LogoProps> = ({ gate }) => {
  if (!shouldRenderLogo(gate)) return null;
  return (
    <Box flexDirection="column">
      {LOGO_LINES.map((line, i) => (
        <Text key={i} color={LOGO_COLORS[i]} bold>
          {line}
        </Text>
      ))}
    </Box>
  );
};
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test logo
```

Expected: all 5 tests pass.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run typecheck
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add bun/src/picker/Logo.tsx bun/tests/logo.test.tsx
git commit -m "feat(bun): Logo Ink component with all four gates

Renders the 6-row gradient logo when shouldRenderLogo() passes; emits
nothing otherwise. Component consumes a pre-resolved LogoGateInputs
so tests can drive every gate combination from one signature.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Preview keys + Row + List components

**Files:**
- Create: `bun/src/picker/previewKeys.ts`
- Create: `bun/src/picker/Row.tsx`
- Create: `bun/src/picker/List.tsx`
- Create: `bun/tests/row.test.tsx`

- [ ] **Step 1: Create `bun/src/picker/previewKeys.ts`**

```typescript
// Ordered env→label list for the preview pane. Mirrors lib/tui.sh's
// CCWS_PREVIEW_KEYS. Label duplicates (e.g. HTTPS_PROXY and HTTP_PROXY
// both → 'proxy') are intentional; Preview.tsx dedups by label so the
// first matching env-var per label wins.
export interface PreviewKey {
  env: string;
  label: string;
}

export const PREVIEW_KEYS: readonly PreviewKey[] = [
  { env: 'ANTHROPIC_BASE_URL', label: 'endpoint' },
  { env: 'HTTPS_PROXY', label: 'proxy' },
  { env: 'https_proxy', label: 'proxy' },
  { env: 'HTTP_PROXY', label: 'proxy' },
  { env: 'http_proxy', label: 'proxy' },
  { env: 'ANTHROPIC_MODEL', label: 'model' },
  { env: 'ANTHROPIC_AUTH_TOKEN', label: 'token' },
  { env: 'CCWS_CREATED', label: 'created' },
  { env: 'CCWS_DESCRIPTION', label: 'description' },
  { env: 'ANTHROPIC_DEFAULT_OPUS_MODEL', label: 'opus' },
  { env: 'ANTHROPIC_DEFAULT_SONNET_MODEL', label: 'sonnet' },
  { env: 'ANTHROPIC_DEFAULT_HAIKU_MODEL', label: 'haiku' },
  { env: 'CLAUDE_CODE_EFFORT_LEVEL', label: 'effort' },
  { env: 'CLAUDE_CODE_SUBAGENT_MODEL', label: 'subagent' },
  { env: 'ALL_PROXY', label: 'socks' },
  { env: 'all_proxy', label: 'socks' },
  { env: 'NO_PROXY', label: 'no_proxy' },
  { env: 'no_proxy', label: 'no_proxy' },
  { env: 'CCWS_BINARY', label: 'binary' },
] as const;
```

- [ ] **Step 2: Write the failing Row tests**

Create `bun/tests/row.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Row } from '../src/picker/Row.js';
import type { Workspace } from '../src/workspace.js';

const baseWs: Workspace = {
  name: 'work',
  endpoint: 'anthropic',
  proxy: false,
  dangerous: false,
  active: false,
  envPath: '/tmp/work/ccws.env',
  env: {},
  mtime: 0,
};

describe('Row', () => {
  it('renders the workspace name', () => {
    const { lastFrame } = render(<Row workspace={baseWs} isCursor={false} />);
    expect(lastFrame()).toContain('work');
  });

  it('shows the cursor pointer when isCursor=true', () => {
    const { lastFrame } = render(<Row workspace={baseWs} isCursor={true} />);
    expect(lastFrame()).toContain('❯');
  });

  it('hides the cursor pointer when isCursor=false', () => {
    const { lastFrame } = render(<Row workspace={baseWs} isCursor={false} />);
    expect(lastFrame()).not.toContain('❯');
  });

  it('renders proxy glyph when proxy=true', () => {
    const { lastFrame } = render(<Row workspace={{ ...baseWs, proxy: true }} isCursor={false} />);
    expect(lastFrame()).toContain('● proxy');
  });

  it('renders direct glyph when proxy=false', () => {
    const { lastFrame } = render(<Row workspace={baseWs} isCursor={false} />);
    expect(lastFrame()).toContain('○ direct');
  });

  it('renders yolo glyph when dangerous=true', () => {
    const { lastFrame } = render(<Row workspace={{ ...baseWs, dangerous: true }} isCursor={false} />);
    expect(lastFrame()).toContain('⚡ yolo');
  });

  it('renders safe glyph when dangerous=false', () => {
    const { lastFrame } = render(<Row workspace={baseWs} isCursor={false} />);
    expect(lastFrame()).toContain('· safe');
  });

  it('renders active marker when active=true', () => {
    const { lastFrame } = render(<Row workspace={{ ...baseWs, active: true }} isCursor={false} />);
    expect(lastFrame()).toContain('· active');
  });
});
```

- [ ] **Step 3: Run tests, verify they fail**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test row
```

Expected: 8 failures, "Cannot find module '../src/picker/Row.js'".

- [ ] **Step 4: Implement `bun/src/picker/Row.tsx`**

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import type { Workspace } from '../workspace.js';
import { COLORS } from '../colors.js';

const NAME_W = 12;
const EP_W = 24;

function endpointShort(url: string): string {
  if (url === '' || url === 'anthropic' || url.includes('api.anthropic.com')) return 'anthropic';
  if (url.includes('api.deepseek.com')) return 'deepseek-gw';
  if (url.includes('api.openai.com')) return 'openai-gw';
  const m = url.match(/^[a-z]+:\/\/([^/]+)/);
  return m ? m[1]! : url;
}

function truncate(s: string, w: number): string {
  if (s.length <= w) return s.padEnd(w);
  return s.slice(0, w - 1) + '…';
}

function endpointColor(short: string): string {
  if (short === 'anthropic') return COLORS.sky;
  if (short.endsWith('-gw')) return COLORS.yellow;
  return COLORS.lavender;
}

export interface RowProps {
  workspace: Workspace;
  isCursor: boolean;
}

export const Row: React.FC<RowProps> = ({ workspace, isCursor }) => {
  const ep = truncate(endpointShort(workspace.endpoint), EP_W);
  const name = truncate(workspace.name, NAME_W);
  return (
    <Box>
      <Text color={COLORS.green} bold>
        {isCursor ? '❯ ' : '  '}
      </Text>
      <Text color={workspace.active ? COLORS.green : COLORS.pink} bold={workspace.active}>
        {name}
      </Text>
      <Text>  </Text>
      <Text color={endpointColor(endpointShort(workspace.endpoint))}>{ep}</Text>
      <Text>  </Text>
      {workspace.proxy ? (
        <Text color={COLORS.green}>● proxy </Text>
      ) : (
        <Text color={COLORS.dim}>○ direct</Text>
      )}
      <Text>  </Text>
      {workspace.dangerous ? (
        <Text color={COLORS.red}>⚡ yolo </Text>
      ) : (
        <Text color={COLORS.dim}>· safe </Text>
      )}
      {workspace.active && (
        <Text color={COLORS.dim}>  · active</Text>
      )}
    </Box>
  );
};
```

- [ ] **Step 5: Run tests, verify they pass**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test row
```

Expected: all 8 tests pass.

- [ ] **Step 6: Implement `bun/src/picker/List.tsx`** (no separate test — exercised by App integration tests in Task 9)

```typescript
import React from 'react';
import { Box } from 'ink';
import type { Workspace } from '../workspace.js';
import { Row } from './Row.js';

export interface ListProps {
  workspaces: Workspace[];
  cursorName: string | null;
}

export const List: React.FC<ListProps> = ({ workspaces, cursorName }) => {
  return (
    <Box flexDirection="column">
      {workspaces.map((ws) => (
        <Row key={ws.name} workspace={ws} isCursor={ws.name === cursorName} />
      ))}
    </Box>
  );
};
```

- [ ] **Step 7: Typecheck**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run typecheck
```

Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add bun/src/picker/Row.tsx bun/src/picker/List.tsx bun/src/picker/previewKeys.ts bun/tests/row.test.tsx
git commit -m "feat(bun): Row + List + previewKeys

Row renders a single workspace with name+endpoint+proxy+dangerous
columns and optional ❯ cursor pointer + '· active' suffix. List wraps
Row in a vertical Box keyed by workspace name (so cursor stays put
when the array mutates from a Tab toggle). previewKeys.ts mirrors the
bash CCWS_PREVIEW_KEYS table.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Preview component

**Files:**
- Create: `bun/src/picker/Preview.tsx`
- Create: `bun/tests/preview.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `bun/tests/preview.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Preview } from '../src/picker/Preview.js';
import type { Workspace } from '../src/workspace.js';

function makeWs(env: Record<string, string>): Workspace {
  return {
    name: 'w',
    endpoint: env.ANTHROPIC_BASE_URL ?? 'anthropic',
    proxy: false,
    dangerous: false,
    active: false,
    envPath: '/tmp/w/ccws.env',
    env,
    mtime: 0,
  };
}

describe('Preview', () => {
  it('renders endpoint + token label/value pairs', () => {
    const ws = makeWs({
      ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
      ANTHROPIC_AUTH_TOKEN: 'secret',
    });
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('endpoint');
    expect(frame).toContain('https://api.anthropic.com');
    expect(frame).toContain('token');
    expect(frame).toContain('***');
    expect(frame).not.toContain('secret');
  });

  it('dedupes labels (HTTPS_PROXY + http_proxy both label "proxy" → one row)', () => {
    const ws = makeWs({
      HTTPS_PROXY: 'http://1.2.3.4:8080',
      http_proxy: 'http://1.2.3.4:8080',
    });
    const { lastFrame } = render(<Preview workspace={ws} />);
    const frame = lastFrame() ?? '';
    const proxyRows = frame.split('\n').filter((row) => /\bproxy\b/.test(row));
    expect(proxyRows.length).toBe(1);
  });

  it('masks *_TOKEN, *_AUTH, *_AUTH_TOKEN values', () => {
    const ws = makeWs({ ANTHROPIC_AUTH_TOKEN: 's3cret' });
    const { lastFrame } = render(<Preview workspace={ws} />);
    expect(lastFrame()).toContain('***');
    expect(lastFrame()).not.toContain('s3cret');
  });

  it('renders (no ccws.env) warning when env is empty', () => {
    const ws = makeWs({});
    const { lastFrame } = render(<Preview workspace={ws} />);
    expect(lastFrame()).toContain('(ccws.env empty or malformed)');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test preview
```

Expected: 4 failures, "Cannot find module".

- [ ] **Step 3: Implement `bun/src/picker/Preview.tsx`**

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import type { Workspace } from '../workspace.js';
import { PREVIEW_KEYS } from './previewKeys.js';
import { COLORS } from '../colors.js';

const TOKEN_LIKE = /_(TOKEN|AUTH|AUTH_TOKEN)$/;

interface Row {
  label: string;
  value: string;
}

function buildRows(env: Record<string, string>): Row[] {
  const rows: Row[] = [];
  const seenLabels = new Set<string>();
  for (const { env: envName, label } of PREVIEW_KEYS) {
    if (seenLabels.has(label)) continue;
    if (!(envName in env)) continue;
    let value = env[envName]!;
    if (TOKEN_LIKE.test(envName) && value !== '') {
      value = '***';
    }
    rows.push({ label, value });
    seenLabels.add(label);
  }
  return rows;
}

export interface PreviewProps {
  workspace: Workspace | null;
}

export const Preview: React.FC<PreviewProps> = ({ workspace }) => {
  if (!workspace) return null;
  const rows = buildRows(workspace.env);
  if (rows.length === 0) {
    return (
      <Box>
        <Text color={COLORS.red}>  (ccws.env empty or malformed)</Text>
      </Box>
    );
  }
  return (
    <Box flexDirection="column">
      {rows.map((row) => (
        <Box key={row.label}>
          <Text color={COLORS.pink}>{row.label.padEnd(14)}</Text>
          <Text color={COLORS.fg}>{row.value}</Text>
        </Box>
      ))}
    </Box>
  );
};
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test preview
```

Expected: all 4 tests pass.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run typecheck
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add bun/src/picker/Preview.tsx bun/tests/preview.test.tsx
git commit -m "feat(bun): Preview component with label dedup + token masking

Renders key/value rows from CCWS_PREVIEW_KEYS in order. Label dedup
(only first env-var per label) matches bash semantics — needed because
HTTPS_PROXY + http_proxy both have label 'proxy'. Token masking on
*_TOKEN / *_AUTH / *_AUTH_TOKEN env names matches bash, but preserves
empty values (so NO_PROXY= still shows as a real override).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: State reducer

**Files:**
- Create: `bun/src/picker/state.ts`
- Create: `bun/tests/state.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `bun/tests/state.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { reducer, initialState, type State, type Action } from '../src/picker/state.js';
import type { Workspace } from '../src/workspace.js';

function ws(name: string, overrides: Partial<Workspace> = {}): Workspace {
  return {
    name,
    endpoint: 'anthropic',
    proxy: false,
    dangerous: false,
    active: false,
    envPath: `/tmp/${name}/ccws.env`,
    env: {},
    mtime: 0,
    ...overrides,
  };
}

const A = ws('astratech');
const D = ws('deepseek');
const G = ws('gradient');

describe('reducer', () => {
  it('moveCursor down advances cursorName in the filtered order', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'astratech' };
    const next = reducer(s, { type: 'moveCursor', dir: 'down' });
    expect(next.cursorName).toBe('deepseek');
  });

  it('moveCursor down at end is a no-op (no wrap)', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'gradient' };
    const next = reducer(s, { type: 'moveCursor', dir: 'down' });
    expect(next.cursorName).toBe('gradient');
  });

  it('moveCursor up at start is a no-op', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'astratech' };
    const next = reducer(s, { type: 'moveCursor', dir: 'up' });
    expect(next.cursorName).toBe('astratech');
  });

  it('setQuery filters by fuzzy substring of name', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'astratech' };
    const next = reducer(s, { type: 'setQuery', value: 'deep' });
    expect(next.query).toBe('deep');
    // cursor snaps to first filtered match
    expect(next.cursorName).toBe('deepseek');
  });

  it('setQuery cursor stays put if it is in the filtered set', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'gradient' };
    const next = reducer(s, { type: 'setQuery', value: 'r' });  // 'astratech', 'gradient'
    expect(next.cursorName).toBe('gradient');
  });

  it('setQuery snaps cursor to first filtered match when current cursor is filtered out', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'deepseek' };
    const next = reducer(s, { type: 'setQuery', value: 'a' });  // 'astratech', 'gradient'
    expect(next.cursorName).toBe('astratech');
  });

  it('setQuery empty restores full list (cursor preserved if still present)', () => {
    const s: State = { workspaces: [A, D, G], query: 'a', cursorName: 'astratech' };
    const next = reducer(s, { type: 'setQuery', value: '' });
    expect(next.cursorName).toBe('astratech');
  });

  it('refreshWorkspaces replaces array, preserves cursor by name when possible', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'deepseek' };
    const Dyolo = ws('deepseek', { dangerous: true });
    const next = reducer(s, { type: 'refreshWorkspaces', workspaces: [A, Dyolo, G] });
    expect(next.cursorName).toBe('deepseek');
    expect(next.workspaces[1]!.dangerous).toBe(true);
  });

  it('refreshWorkspaces snaps cursor to first when the previous cursor name is gone', () => {
    const s: State = { workspaces: [A, D, G], query: '', cursorName: 'deepseek' };
    const next = reducer(s, { type: 'refreshWorkspaces', workspaces: [A, G] });
    expect(next.cursorName).toBe('astratech');
  });

  it('initialState picks cursor = active workspace when present, else first', () => {
    const s1 = initialState([A, D, G], 'gradient');
    expect(s1.cursorName).toBe('gradient');
    const s2 = initialState([A, D, G], null);
    expect(s2.cursorName).toBe('astratech');
    const s3 = initialState([A, D, G], 'nonexistent');
    expect(s3.cursorName).toBe('astratech');
  });
});

describe('filtered', () => {
  it('empty query returns all', async () => {
    const { filtered } = await import('../src/picker/state.js');
    expect(filtered([A, D, G], '').map((w) => w.name)).toEqual(['astratech', 'deepseek', 'gradient']);
  });

  it('substring match is case-insensitive', async () => {
    const { filtered } = await import('../src/picker/state.js');
    expect(filtered([A, D, G], 'GRAD').map((w) => w.name)).toEqual(['gradient']);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test state
```

Expected: 12 failures.

- [ ] **Step 3: Implement `bun/src/picker/state.ts`**

```typescript
import type { Workspace } from '../workspace.js';

export interface State {
  workspaces: Workspace[];
  query: string;
  cursorName: string | null;
}

export type Action =
  | { type: 'moveCursor'; dir: 'up' | 'down' }
  | { type: 'setQuery'; value: string }
  | { type: 'refreshWorkspaces'; workspaces: Workspace[] };

export function filtered(workspaces: Workspace[], query: string): Workspace[] {
  if (query === '') return workspaces;
  const q = query.toLowerCase();
  return workspaces.filter((w) => w.name.toLowerCase().includes(q));
}

export function initialState(workspaces: Workspace[], activeName: string | null): State {
  let cursorName: string | null = null;
  if (activeName && workspaces.some((w) => w.name === activeName)) {
    cursorName = activeName;
  } else if (workspaces.length > 0) {
    cursorName = workspaces[0]!.name;
  }
  return { workspaces, query: '', cursorName };
}

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'moveCursor': {
      const list = filtered(state.workspaces, state.query);
      if (list.length === 0) return state;
      const idx = list.findIndex((w) => w.name === state.cursorName);
      if (idx === -1) {
        return { ...state, cursorName: list[0]!.name };
      }
      const nextIdx = action.dir === 'down' ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= list.length) return state;
      return { ...state, cursorName: list[nextIdx]!.name };
    }
    case 'setQuery': {
      const list = filtered(state.workspaces, action.value);
      let cursorName = state.cursorName;
      if (cursorName === null || !list.some((w) => w.name === cursorName)) {
        cursorName = list.length > 0 ? list[0]!.name : null;
      }
      return { ...state, query: action.value, cursorName };
    }
    case 'refreshWorkspaces': {
      const list = filtered(action.workspaces, state.query);
      let cursorName = state.cursorName;
      if (cursorName === null || !list.some((w) => w.name === cursorName)) {
        cursorName = list.length > 0 ? list[0]!.name : null;
      }
      return { ...state, workspaces: action.workspaces, cursorName };
    }
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test state
```

Expected: all 12 tests pass.

- [ ] **Step 5: Typecheck**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run typecheck
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add bun/src/picker/state.ts bun/tests/state.test.ts
git commit -m "feat(bun): picker state reducer + filter

Pure functions: filtered(workspaces, query) for case-insensitive
substring filter, initialState(workspaces, activeName) for the entry
state (cursor on active workspace or first), reducer(state, action)
for moveCursor / setQuery / refreshWorkspaces transitions.

Cursor is keyed by name throughout — refreshWorkspaces (used after
Tab toggle) keeps cursor on the same workspace even though the
underlying array is a new identity.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: App composition + Search component + integration tests

**Files:**
- Create: `bun/src/picker/Search.tsx`
- Create: `bun/src/picker/App.tsx`
- Create: `bun/tests/picker.test.tsx`

- [ ] **Step 1: Write the failing integration tests**

Create `bun/tests/picker.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { App } from '../src/picker/App.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'ccws-app-'));
  for (const name of ['astratech', 'deepseek', 'gradient']) {
    mkdirSync(join(tmp, name));
    writeFileSync(join(tmp, name, 'ccws.env'), `ANTHROPIC_BASE_URL=https://api.anthropic.com\nCCWS_CREATED=2026-01-01\n`);
  }
});

function pass() {
  return {
    envNoLogo: '1',  // disable logo in tests to keep frames small
    stderrIsTTY: true,
    cols: 120,
    lines: 40,
    forceForTests: true,
  };
}

describe('App', () => {
  it('renders all 3 workspaces on initial mount', () => {
    const { lastFrame } = render(<App workspacesDir={tmp} activeName={null} logoGate={pass()} onExit={() => {}} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('astratech');
    expect(frame).toContain('deepseek');
    expect(frame).toContain('gradient');
  });

  it('cursor starts on the first workspace when activeName is null', () => {
    const { lastFrame } = render(<App workspacesDir={tmp} activeName={null} logoGate={pass()} onExit={() => {}} />);
    const lines = (lastFrame() ?? '').split('\n');
    const cursorLine = lines.find((l) => l.includes('❯'));
    expect(cursorLine).toContain('astratech');
  });

  it('cursor starts on the active workspace when activeName is set', () => {
    const { lastFrame } = render(<App workspacesDir={tmp} activeName="deepseek" logoGate={pass()} onExit={() => {}} />);
    const lines = (lastFrame() ?? '').split('\n');
    const cursorLine = lines.find((l) => l.includes('❯'));
    expect(cursorLine).toContain('deepseek');
  });

  it('arrow down moves cursor to next workspace', () => {
    const { lastFrame, stdin } = render(<App workspacesDir={tmp} activeName={null} logoGate={pass()} onExit={() => {}} />);
    stdin.write('\u001B[B');  // ↓
    const lines = (lastFrame() ?? '').split('\n');
    const cursorLine = lines.find((l) => l.includes('❯'));
    expect(cursorLine).toContain('deepseek');
  });

  it('typing into search filters the list', () => {
    const { lastFrame, stdin } = render(<App workspacesDir={tmp} activeName={null} logoGate={pass()} onExit={() => {}} />);
    stdin.write('grad');
    const frame = lastFrame() ?? '';
    expect(frame).toContain('gradient');
    expect(frame).not.toContain('astratech');
    expect(frame).not.toContain('deepseek');
  });

  it('Tab toggles CCWS_DANGEROUS on the current row, preserving cursor', () => {
    const { lastFrame, stdin } = render(<App workspacesDir={tmp} activeName={null} logoGate={pass()} onExit={() => {}} />);
    stdin.write('\u001B[B');  // ↓ to deepseek
    stdin.write('\t');         // Tab
    // ccws.env should now contain CCWS_DANGEROUS=1 for deepseek
    const envText = readFileSync(join(tmp, 'deepseek', 'ccws.env'), 'utf8');
    expect(envText).toMatch(/^CCWS_DANGEROUS=1$/m);
    // Cursor still on deepseek
    const lines = (lastFrame() ?? '').split('\n');
    const cursorLine = lines.find((l) => l.includes('❯'));
    expect(cursorLine).toContain('deepseek');
    // Row now shows yolo glyph
    expect(lastFrame() ?? '').toContain('⚡ yolo');
  });

  it('Tab again removes CCWS_DANGEROUS, switching back to safe', () => {
    const { lastFrame, stdin } = render(<App workspacesDir={tmp} activeName={null} logoGate={pass()} onExit={() => {}} />);
    stdin.write('\t');  // toggle astratech ON
    stdin.write('\t');  // toggle astratech OFF
    const envText = readFileSync(join(tmp, 'astratech', 'ccws.env'), 'utf8');
    expect(envText).not.toMatch(/CCWS_DANGEROUS=1/);
  });

  it('Enter calls onExit with the cursor workspace name and exitCode 0', () => {
    let received: { name: string; exitCode: number } | null = null;
    const { stdin } = render(
      <App
        workspacesDir={tmp}
        activeName={null}
        logoGate={pass()}
        onExit={(name, exitCode) => { received = { name: name ?? '', exitCode }; }}
      />,
    );
    stdin.write('\u001B[B');  // ↓ to deepseek
    stdin.write('\r');         // Enter
    expect(received).toEqual({ name: 'deepseek', exitCode: 0 });
  });

  it('Esc calls onExit with null name and exitCode 130', () => {
    let received: { name: string | null; exitCode: number } | null = null;
    const { stdin } = render(
      <App
        workspacesDir={tmp}
        activeName={null}
        logoGate={pass()}
        onExit={(name, exitCode) => { received = { name, exitCode }; }}
      />,
    );
    stdin.write('\u001B');  // Esc
    expect(received).toEqual({ name: null, exitCode: 130 });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test picker
```

Expected: 9 failures, "Cannot find module".

- [ ] **Step 3: Implement `bun/src/picker/Search.tsx`**

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { COLORS } from '../colors.js';

export interface SearchProps {
  query: string;
  onChange: (value: string) => void;
  shown: number;
  total: number;
}

export const Search: React.FC<SearchProps> = ({ query, onChange, shown, total }) => {
  return (
    <Box>
      <Text color={COLORS.mauve}>{'› '}</Text>
      <TextInput value={query} onChange={onChange} />
      <Box flexGrow={1} />
      <Text color={COLORS.mauve}>{`${shown}/${total}`}</Text>
    </Box>
  );
};
```

- [ ] **Step 4: Implement `bun/src/picker/App.tsx`**

```typescript
import React, { useReducer, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { Logo } from './Logo.js';
import { List } from './List.js';
import { Preview } from './Preview.js';
import { Search } from './Search.js';
import { reducer, initialState, filtered } from './state.js';
import { scanWorkspaces } from '../workspace.js';
import { setEnvKey, unsetEnvKey } from '../env.js';
import { COLORS, RULE } from '../colors.js';
import type { LogoGateInputs } from '../logoData.js';

export interface AppProps {
  workspacesDir: string;
  activeName: string | null;
  logoGate: LogoGateInputs;
  onExit: (selectedName: string | null, exitCode: number) => void;
}

export const App: React.FC<AppProps> = ({ workspacesDir, activeName, logoGate, onExit }) => {
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    initialState(scanWorkspaces({ workspacesDir, activeName }), activeName),
  );

  const list = filtered(state.workspaces, state.query);
  const cursor = list.find((w) => w.name === state.cursorName) ?? null;

  useInput((input, key) => {
    if (key.escape) {
      onExit(null, 130);
      return;
    }
    if (key.return) {
      onExit(state.cursorName, 0);
      return;
    }
    if (key.upArrow) {
      dispatch({ type: 'moveCursor', dir: 'up' });
      return;
    }
    if (key.downArrow) {
      dispatch({ type: 'moveCursor', dir: 'down' });
      return;
    }
    if (key.tab) {
      // Toggle CCWS_DANGEROUS on the current workspace's ccws.env, then
      // refresh the workspaces list (cursor stays by name).
      if (cursor) {
        if (cursor.dangerous) {
          unsetEnvKey(cursor.envPath, 'CCWS_DANGEROUS');
        } else {
          setEnvKey(cursor.envPath, 'CCWS_DANGEROUS', '1');
        }
        const fresh = scanWorkspaces({ workspacesDir, activeName });
        dispatch({ type: 'refreshWorkspaces', workspaces: fresh });
      }
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <Logo gate={logoGate} />
      <Text color={COLORS.dim}>{RULE}</Text>
      <Text color={COLORS.dim}>
        {'↑↓ navigate    type to filter    ↵ activate    Tab toggle yolo    esc cancel'}
      </Text>
      <Box>{/* spacer */}</Box>
      <Search
        query={state.query}
        onChange={(v) => dispatch({ type: 'setQuery', value: v })}
        shown={list.length}
        total={state.workspaces.length}
      />
      <Box>{/* spacer */}</Box>
      <List workspaces={list} cursorName={state.cursorName} />
      <Text color={COLORS.dim}>{RULE}</Text>
      <Preview workspace={cursor} />
    </Box>
  );
};
```

- [ ] **Step 5: Run tests, verify they pass**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test picker
```

Expected: all 9 picker integration tests pass.

- [ ] **Step 6: Typecheck**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run typecheck
```

Expected: exit 0.

- [ ] **Step 7: Run the full test suite**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run test
```

Expected: all tests across all files pass (~40+).

- [ ] **Step 8: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add bun/src/picker/App.tsx bun/src/picker/Search.tsx bun/tests/picker.test.tsx
git commit -m "feat(bun): App + Search composition with keymap

App wires Logo + Header + Search + List + Preview around a useReducer
state machine. Keymap: ↑↓ navigate, Tab toggles CCWS_DANGEROUS via
setEnvKey/unsetEnvKey then refreshWorkspaces, Enter calls onExit with
the cursor name + exitCode 0, Esc calls onExit with null + exitCode
130. Search uses ink-text-input — typing any character (including 'y')
goes into the filter; Tab is the toggle so there's no collision.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: CLI entry point (`bun/src/index.ts`)

**Files:**
- Create: `bun/src/index.ts`

The entry point handles stdin/stdout discipline. It must:
- Render to stderr (Ink defaults to stdout, we redirect to stderr via the `stdout` prop on `render`)
- Print the selected name to stdout on exit
- Exit with the right code (0 / 130 / 1)

- [ ] **Step 1: Implement `bun/src/index.ts`**

```typescript
#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { App } from './picker/App.js';
import { scanWorkspaces, defaultWorkspacesDir } from './workspace.js';
import type { LogoGateInputs } from './logoData.js';

function gateInputs(): LogoGateInputs {
  return {
    envNoLogo: process.env.CCWS_NO_LOGO,
    stderrIsTTY: Boolean(process.stderr.isTTY),
    cols: process.stdout.columns ?? 80,
    lines: process.stdout.rows ?? 24,
  };
}

async function main(): Promise<void> {
  const workspacesDir = defaultWorkspacesDir();
  const initial = scanWorkspaces({ workspacesDir, activeName: process.env.CCWS_NAME ?? null });
  if (initial.length === 0) {
    process.stderr.write("ccws: warn: no workspaces — run 'ccws add <name>'\n");
    process.exit(1);
  }

  // Render Ink to stderr so stdout stays clean for the selected name.
  const inkInstance = render(
    React.createElement(App, {
      workspacesDir,
      activeName: process.env.CCWS_NAME ?? null,
      logoGate: gateInputs(),
      onExit: (selected, exitCode) => {
        inkInstance.unmount();
        if (selected !== null && exitCode === 0) {
          process.stdout.write(`${selected}\n`);
        }
        process.exit(exitCode);
      },
    }),
    { stdout: process.stderr, exitOnCtrlC: false },
  );

  await inkInstance.waitUntilExit();
}

void main();
```

- [ ] **Step 2: Smoke test it manually**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run dev
```

Expected: in a real terminal (must be a tty), the picker UI renders, ↑↓/Tab/Enter/Esc work. Press Esc; observe exit code 130 (`echo $?`).

- [ ] **Step 3: Smoke test selection output**

```bash
cd /Users/kola/workspace/ccws-bun/bun
selection=$(bun run dev)  # interactively select a workspace
echo "got: '$selection'"
```

Expected: the selected workspace name printed (alone, no ANSI bleed). On Esc: empty.

- [ ] **Step 4: Typecheck**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run typecheck
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add bun/src/index.ts
git commit -m "feat(bun): CLI entry — render to stderr, emit selection to stdout

Ink renders the picker to stderr (so stdout stays a clean channel for
the selected workspace name). exit codes: 0 for selection, 130 for Esc
(SIGINT convention; 128+SIGINT=2), 1 for 'no workspaces' guidance.
process.env.CCWS_NAME drives the active-row marker.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Build script (`bun/build.ts`)

**Files:**
- Create: `bun/build.ts`

- [ ] **Step 1: Create `bun/build.ts`**

```typescript
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
```

- [ ] **Step 2: Run a build (just darwin host for now to verify scaffolding)**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun build --compile --target=bun-darwin-arm64 src/index.ts --outfile dist/test-build-host
file dist/test-build-host
./dist/test-build-host --version || true
```

Expected: `file` reports a Mach-O 64-bit executable arm64; the binary runs (may need a tty to render).

- [ ] **Step 3: Run the full build script**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run build
ls -lh dist/
```

Expected: 4 binaries, each roughly 60-100MB. Names match the TARGETS list above.

- [ ] **Step 4: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add bun/build.ts
git commit -m "build(bun): cross-compile to 4 platform targets

bun build --compile --minify for darwin/linux × arm64/x64. Output to
bun/dist/. Build script runs all targets sequentially; on any failure
exits 1 so CI can gate on it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Bash bridge — `lib/tui.sh` invokes binary when present

**Files:**
- Modify: `lib/tui.sh`
- Modify: `tests/integration/tui.bats`

This task is back in the **main checkout** (`~/workspace/ccws`), not the worktree — the bash change lives on the existing branch so existing bash ccws users get the new behavior when they pull. The worktree's branch will eventually merge this in too.

For now we'll do the bash change on the same `spec/bun-rewrite` branch in the worktree to keep all Phase 1 changes co-located. When merging to main, both sides land together.

- [ ] **Step 1: Inspect current `ccws_tui_run` to anchor the edit**

```bash
cd /Users/kola/workspace/ccws-bun
grep -n 'ccws_tui_run()' lib/tui.sh
```

Expected: a function definition with a `case "$engine"` body.

- [ ] **Step 2: Add the binary-detection prelude**

Edit `lib/tui.sh`. Locate the `ccws_tui_run()` function. Replace its body with:

```bash
# Main entry point — returns selected workspace name on stdout, empty if cancelled.
#
# Prefers ~/.ccws/bin/ccws-picker (Phase 1 of the Bun rewrite) when
# present; falls back to the bash fzf/fallback path otherwise. This
# preserves backward compatibility — users who haven't installed the
# binary keep the fzf picker; installers get the new TUI.
ccws_tui_run() {
    local binary="$HOME/.ccws/bin/ccws-picker"
    if [[ -x "$binary" ]] && [[ "${CCWS_USE_BASH_TUI:-0}" != "1" ]]; then
        "$binary"
        return $?
    fi
    local engine
    engine=$(ccws_tui_engine)
    case "$engine" in
        fzf)      source "$_libdir/tui_fzf.sh";      ccws_tui_fzf_pick      ;;
        fallback) source "$_libdir/tui_fallback.sh"; ccws_tui_fallback_pick ;;
    esac
}
```

`CCWS_USE_BASH_TUI=1` is an escape hatch — users who want to force the bash path (e.g., for debugging or if the binary is misbehaving) can set this in their shell.

- [ ] **Step 3: Add bridge tests to `tests/integration/tui.bats`**

Append to `tests/integration/tui.bats`:

```bash
@test "ccws_tui_run delegates to ~/.ccws/bin/ccws-picker when present" {
    mkdir -p "$HOME/.ccws/bin"
    cat > "$HOME/.ccws/bin/ccws-picker" <<'EOF'
#!/usr/bin/env bash
echo "work"
exit 0
EOF
    chmod +x "$HOME/.ccws/bin/ccws-picker"
    run ccws_tui_run
    [[ "$status" -eq 0 ]]
    [[ "$output" == "work" ]]
    rm -f "$HOME/.ccws/bin/ccws-picker"
}

@test "ccws_tui_run honors binary exit code 130 (cancel)" {
    mkdir -p "$HOME/.ccws/bin"
    cat > "$HOME/.ccws/bin/ccws-picker" <<'EOF'
#!/usr/bin/env bash
exit 130
EOF
    chmod +x "$HOME/.ccws/bin/ccws-picker"
    run ccws_tui_run
    [[ "$status" -eq 130 ]]
    [[ -z "$output" ]]
    rm -f "$HOME/.ccws/bin/ccws-picker"
}

@test "ccws_tui_run falls back to bash engine when binary absent" {
    rm -f "$HOME/.ccws/bin/ccws-picker"
    # We can't fully run the bash engine in bats (no tty), but verify
    # ccws_tui_run doesn't error out trying to invoke a missing binary.
    # The fzf engine will likely route to fallback (no tty); fallback
    # without stdin will read EOF and return 1 — that's expected.
    run bash -c "
        export HOME='$HOME'
        export CCWS_NO_TUI=1
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui_fallback.sh'
        ccws_tui_run </dev/null
    "
    # Exit non-zero is fine here (no selection made). The point is that
    # ccws_tui_run reached the bash fallback rather than erroring on the
    # missing binary.
    [[ "$output" != *"command not found"* ]]
    [[ "$output" != *"No such file"* ]]
}

@test "ccws_tui_run respects CCWS_USE_BASH_TUI=1 escape hatch" {
    mkdir -p "$HOME/.ccws/bin"
    cat > "$HOME/.ccws/bin/ccws-picker" <<'EOF'
#!/usr/bin/env bash
echo "FROM_BINARY"
EOF
    chmod +x "$HOME/.ccws/bin/ccws-picker"
    # With the escape hatch set, the binary should NOT be invoked.
    run bash -c "
        export HOME='$HOME'
        export CCWS_USE_BASH_TUI=1
        export CCWS_NO_TUI=1
        source '$CCWS_PROJECT_ROOT/lib/common.sh'
        source '$CCWS_PROJECT_ROOT/lib/env.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui.sh'
        source '$CCWS_PROJECT_ROOT/lib/tui_fallback.sh'
        ccws_tui_run </dev/null
    "
    [[ "$output" != *"FROM_BINARY"* ]]
    rm -f "$HOME/.ccws/bin/ccws-picker"
}
```

- [ ] **Step 4: Run the bats suite**

```bash
cd /Users/kola/workspace/ccws-bun
bats tests/integration/tui.bats
```

Expected: all previous tests pass + 4 new tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add lib/tui.sh tests/integration/tui.bats
git commit -m "feat(tui): bash bridge — ccws_tui_run prefers \$HOME/.ccws/bin/ccws-picker

When the Bun picker binary is installed and executable, ccws_tui_run
hands off to it (returning its exit code unchanged). When absent, the
existing fzf/fallback path runs as before — so this commit is a no-op
for users who haven't installed the new binary yet.

CCWS_USE_BASH_TUI=1 is an escape hatch for users who want to force the
bash path (debugging, regression, or just preference).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: GitHub Actions — extend test workflow + add release workflow

**Files:**
- Modify (or create): `.github/workflows/test.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Check whether a test workflow already exists**

```bash
cd /Users/kola/workspace/ccws-bun
ls -la .github/workflows/ 2>/dev/null || echo "no workflows directory"
```

If `.github/workflows/test.yml` exists, edit it. Otherwise create it.

- [ ] **Step 2: Create / amend `.github/workflows/test.yml`**

```yaml
name: tests

on:
  push:
  pull_request:

jobs:
  bats:
    name: bats (bash)
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
    steps:
      - uses: actions/checkout@v4
      - name: Install bats
        run: |
          if [[ "${{ runner.os }}" == "macOS" ]]; then
            brew install bats-core
          else
            sudo apt-get update && sudo apt-get install -y bats
          fi
      - name: Run bats
        run: bats tests/integration/

  vitest:
    name: vitest (bun)
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - name: Install deps
        run: cd bun && bun install
      - name: Typecheck
        run: cd bun && bun run typecheck
      - name: Run vitest
        run: cd bun && bun run test

  build-verify:
    name: build-verify (${{ matrix.target }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        target:
          - bun-darwin-arm64
          - bun-darwin-x64
          - bun-linux-arm64
          - bun-linux-x64
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - name: Install deps
        run: cd bun && bun install
      - name: Cross-compile
        run: |
          cd bun
          bun build --compile --target=${{ matrix.target }} --minify \
            src/index.ts --outfile dist/ccws-picker-${{ matrix.target#bun-}}
          file dist/ccws-picker-${{ matrix.target#bun-}}
```

- [ ] **Step 3: Create `.github/workflows/release.yml`**

```yaml
name: release

on:
  push:
    tags:
      - 'v[0-9]+.[0-9]+.[0-9]+*'

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        target:
          - { triple: bun-darwin-arm64, suffix: darwin-arm64 }
          - { triple: bun-darwin-x64,   suffix: darwin-x64 }
          - { triple: bun-linux-arm64,  suffix: linux-arm64 }
          - { triple: bun-linux-x64,    suffix: linux-x64 }
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - name: Install deps
        run: cd bun && bun install
      - name: Cross-compile
        run: |
          cd bun
          bun build --compile --target=${{ matrix.target.triple }} --minify \
            src/index.ts --outfile dist/ccws-picker-${{ matrix.target.suffix }}
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ccws-picker-${{ matrix.target.suffix }}
          path: bun/dist/ccws-picker-${{ matrix.target.suffix }}

  release:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts
      - name: Compute checksums
        run: |
          cd artifacts
          for d in ccws-picker-*; do
            (cd "$d" && sha256sum * >> ../SHA256SUMS)
          done
      - name: Create release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            artifacts/ccws-picker-*/*
            artifacts/SHA256SUMS
          generate_release_notes: true
```

- [ ] **Step 4: Validate YAML syntax locally**

```bash
cd /Users/kola/workspace/ccws-bun
# If yamllint is available:
command -v yamllint && yamllint .github/workflows/*.yml || echo "yamllint not installed, skipping"
# If actionlint is available:
command -v actionlint && actionlint .github/workflows/*.yml || echo "actionlint not installed, skipping"
```

- [ ] **Step 5: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add .github/workflows/test.yml .github/workflows/release.yml
git commit -m "ci(bun): add vitest + build-verify jobs and tag-driven release

test.yml grows two matrix jobs: vitest (mac+linux) for the TS code,
build-verify (4 targets) confirms cross-compile still works on every
PR. release.yml fires on v* tag push: cross-compiles all 4 targets,
uploads SHA256SUMS + binaries to a GitHub Release with auto-generated
notes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: DESIGN.md update + Phase 1 wrap

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1: Add the Bun architecture section to DESIGN.md**

Open `DESIGN.md`. Locate the existing `## Versioning` section. Insert a new `## Bun rewrite (Phase 1+)` section directly BEFORE `## Versioning`:

```markdown
## Bun rewrite (Phase 1+)

Starting with v0.7.0 ccws is rewriting itself in TypeScript on the Bun
runtime, in five phases:

1. v0.7.0 — TUI picker becomes a compiled binary (`~/.ccws/bin/ccws-picker`).
   `lib/tui.sh` prefers it when present, falls back to fzf otherwise.
2. v0.8.0 — `ccws use` / `ccws unset` / `ccws list` / `ccws current` move to TS.
3. v0.9.0 — `ccws add` / `ccws rm` / `ccws sync` move to TS.
4. v0.10.0 — `ccws init` / `ccws doctor` / `ccws which` / `ccws local` /
   `ccws global` / `ccws hook` move to TS.
5. v1.0.0 — bash code deleted; `bun/dist/ccws` is canonical.

The TS implementation lives in `bun/`. See
`docs/superpowers/specs/2026-05-20-ccws-bun-rewrite-design.md` for the
full design rationale and per-phase scope.

Why Bun + Ink:
- Bun's `bun build --compile` produces a single binary per platform
  with zero install-time dependencies (no fzf, no gum, no Node).
- Ink (React-on-terminal) lets us key list rows by workspace name —
  cursor sticks across Tab-toggle reloads, which fzf's bind syntax
  couldn't solve no matter which animation primitive we tried
  (`pos({n})`, `track-current`, `transform[...]`).

The Surface Registry table above describes the bash-era surfaces.
After Phase 1 those surfaces remain in code as the fallback path; the
new compiled binary owns the default picker rendering.
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add DESIGN.md
git commit -m "docs(design): document Bun rewrite phasing in DESIGN.md

Adds a section listing the 5-phase migration and the rationale for
Bun + Ink. Surface Registry from the bash era stays accurate — those
surfaces become the fallback after Phase 1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: End-to-end verification + Phase 1 release prep

**Files:**
- None modified; this task is verification + tagging.

- [ ] **Step 1: Final full test suite (bats + vitest)**

```bash
cd /Users/kola/workspace/ccws-bun
bats tests/integration/tui.bats
cd bun
bun run test
bun run typecheck
```

Expected: all green.

- [ ] **Step 2: Build all 4 platform binaries locally**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run build
ls -lh dist/
```

Expected: 4 binaries present, file sizes 50-100MB each.

- [ ] **Step 3: Smoke-test the host-platform binary**

```bash
cd /Users/kola/workspace/ccws-bun/bun
# Replace darwin-arm64 with whatever your host is
mkdir -p ~/.ccws/bin
# Don't overwrite an existing binary if there is one — back it up first.
[[ -f ~/.ccws/bin/ccws-picker ]] && mv ~/.ccws/bin/ccws-picker ~/.ccws/bin/ccws-picker.bak
cp dist/ccws-picker-darwin-arm64 ~/.ccws/bin/ccws-picker
chmod +x ~/.ccws/bin/ccws-picker

# Now run bash ccws — it should invoke the new binary
cd /Users/kola/workspace/ccws  # back to the main checkout where init.sh is sourced
bin/ccws
```

Expected: the new Ink picker appears (with `↑↓ navigate    type to filter    ↵ activate    Tab toggle yolo    esc cancel` help row). Test:
- ↑↓ moves cursor without jumping to top
- typing 'y' goes into the search filter (not to toggle)
- `Tab` toggles dangerous state, cursor stays on row
- Enter selects, exports happen, shell wrapper prompts `[Y/n]`
- Esc exits clean, no logo residue in scrollback

If anything goes wrong, restore the backup: `mv ~/.ccws/bin/ccws-picker.bak ~/.ccws/bin/ccws-picker` (or delete to fall back to fzf).

- [ ] **Step 4: Push and open a PR (or run /ship)**

```bash
cd /Users/kola/workspace/ccws-bun
git log --oneline origin/spec/tui-ascii-logo..HEAD
git push -u origin spec/bun-rewrite
```

Expected: ~14 commits ahead of the base branch.

Open a PR titled `Phase 1: Bun rewrite (compiled picker binary)`. Body covers:
- Spec link
- 5-phase plan summary
- Phase 1 deliverables (this PR)
- Smoke-test verification done
- Risks (binary install required for new picker; bash fzf path retained for users who don't install)

- [ ] **Step 5: Final verification**

After the PR is merged and the v0.7.0 tag is pushed:

```bash
# wait for GitHub Actions release workflow
gh run watch
# verify the release artifacts
gh release view v0.7.0
```

Expected: 4 binaries + SHA256SUMS attached to the release.
