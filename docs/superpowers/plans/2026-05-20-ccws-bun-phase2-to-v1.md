# ccws Bun rewrite — Phase 2 through v1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port every remaining ccws bash command to TypeScript/Bun, ship v1.0 as a single compiled binary with bash deleted from the repo.

**Architecture:** All work happens on the existing `spec/bun-rewrite` branch in the `../ccws-bun` worktree (Phase 1 already shipped on this branch — 16 commits). Each command becomes a TS module under `bun/src/commands/`, dispatched by `bun/src/cli.ts` from `bun/src/index.ts`. The bash `lib/cmd_*.sh` files are deleted only at the very end (Task 38), after every replacement is proven by vitest + a bats integration test that runs the compiled binary. Two stdout protocols are preserved byte-for-byte: `ccws use <name>` emits `export KEY=value` lines, `ccws unset` emits `unset KEY` lines — `share/init.sh` evals these, so they must round-trip identically. `share/init.sh`, `share/init.fish`, `share/claude-wrapper.sh`, and `share/commands/*.md` are not touched.

**Tech Stack:** Bun 1.3+, TypeScript 5.4 (strict), React 18 + Ink 5 (picker only — other commands are pure stdout/stderr), vitest 2 (TS tests), bats (integration tests against the compiled binary), GitHub Actions for the release matrix. Argv parsing is hand-rolled (no commander/yargs — keeps the binary lean and the dispatch logic readable).

---

## File Structure

New TS modules created by this plan, under `bun/src/`:

| File | Responsibility |
|------|----------------|
| `paths.ts` | `ccwsRoot()`, `workspacesDir()`, `wsDir(name)`, `envFile(name)`, `lockFile()`, `globalScopeFile()`, `realClaudeDir()` — all reading `$CCWS_ROOT` / `$HOME` / `$CCWS_REAL_CLAUDE_DIR` |
| `logger.ts` | `logInfo`, `logWarn`, `logError`, `logOk` — `ccws: ...` prefixed lines to stderr |
| `validate.ts` | `validateName(name)` — mirror of `ccws_validate_name` (1-64 chars, `[A-Za-z0-9_-]+`, no reserved names) |
| `shellQuote.ts` | `shQuote(value)` — POSIX-safe single-quote escaping, byte-equivalent to bash `printf '%q'` for the values we emit |
| `scope.ts` | `findLocalFile([cwd])`, `readScopeFile(path)`, `resolveScope()` — pyenv-style walk up + global file |
| `symlinkFarm.ts` | `SHARED_ITEMS`, `farmCreate(name)`, `farmVerify(name)`, `farmSync(name)` |
| `lock.ts` | `withLock(timeoutSec, fn)` — mkdir-based advisory lock (matches bash macOS path) |
| `prompt.ts` | `promptLine(question)`, `promptHidden(question)`, `promptYn(question, default)` — line-buffered stdin reads on stderr |
| `cli.ts` | argv parser + subcommand dispatch table + top-level `--help` / `--version` |
| `commands/use.ts` | `runUse(argv)` — emits `export ...\nexport CCWS_EXPORTED=...` |
| `commands/unset.ts` | `runUnset()` — emits `unset ...` |
| `commands/list.ts` | `runList(argv)` — plain + `--verbose` |
| `commands/current.ts` | `runCurrent(argv)` — plain + `--path` |
| `commands/which.ts` | `runWhich(argv)` — plain + `--explain` |
| `commands/local.ts` | `runLocal(argv)` — read / set / `--unset` |
| `commands/global.ts` | `runGlobal(argv)` — read / set / `--unset` |
| `commands/add.ts` | `runAdd(argv)` — interactive + flag-driven workspace creation |
| `commands/rm.ts` | `runRm(argv)` — confirmation + delete |
| `commands/sync.ts` | `runSync(argv)` — one-or-all symlink refresh |
| `commands/hook.ts` | `runHook(argv)` — emit `source <path>` lines |
| `commands/doctor.ts` | `runDoctor()` — 7 checks + summary |
| `commands/init.ts` | `runInit(argv)` — first-run wizard |
| `commands/picker.ts` | thin wrapper around the existing `App` Ink render — moved out of `index.ts` |
| `version.ts` | `VERSION` constant, single source of truth |

`bun/src/index.ts` shrinks to: parse argv → dispatch to `cli.ts`. All Phase 1 modules (`env.ts`, `workspace.ts`, `colors.ts`, `logoData.ts`, `picker/*.tsx`) stay as-is and are imported by the new code.

New tests under `bun/tests/`: one `*.test.ts` per module above, plus `bun/tests/integration/cli.test.ts` (spawns the compiled binary and asserts on stdout/exit code).

Bash files modified or deleted (Task 38 deletes the lib/* and bin/*; all earlier tasks leave them alone so the fzf fallback keeps working until the very end):

| Path | Final state |
|------|-------------|
| `bin/ccws` | Deleted in Task 38; replaced by a symlink to `bun/dist/ccws-<platform>` written by the new `install.sh` |
| `lib/cmd_*.sh`, `lib/common.sh`, `lib/env.sh`, `lib/lock.sh`, `lib/scope.sh`, `lib/symlink_farm.sh`, `lib/tui*.sh` | All deleted in Task 38 |
| `tests/integration/*.bats`, `tests/helpers/*` | Deleted in Task 38 (replaced by `bun/tests/integration/`) |
| `install.sh` | Rewritten in Task 36 — downloads the binary from GitHub Releases instead of symlinking the bash dispatcher |
| `share/init.sh`, `share/init.fish`, `share/claude-wrapper.sh`, `share/commands/*.md` | Unchanged (the shell wrappers stay, they're the eval entry points) |

---

## Conventions for every task

- **Branch:** all work on `spec/bun-rewrite` in the `../ccws-bun` worktree. No new branches.
- **CWD for commands:** `cd /Users/kola/workspace/ccws-bun/bun` for `bun` and `vitest` commands; `cd /Users/kola/workspace/ccws-bun` for `git` and `bats`.
- **Test runner:** `bun test:unit` is **not** configured — use `bunx vitest run <file>` to run one test file, `bun test` (which equals `bunx vitest run`) for the full suite.
- **TDD:** write the failing vitest first, run it red, write the code, run it green, commit. No skipping.
- **Commit message style:** match the Phase 1 commits — `feat(bun): ...`, `fix(bun): ...`, `test(bun): ...`, `chore(bun): ...`. Body optional. No `Co-Authored-By` line.
- **`process.exit` ban:** command modules return `Promise<number>` (the exit code). Only `bun/src/index.ts` calls `process.exit`. This keeps modules testable.
- **No `any`:** strict mode is on. Use `unknown` + narrowing when you have to.
- **Imports:** always `.js` extensions in TS imports (Bun + ESM require it).

---

## Phase A — Shared infrastructure (Tasks 1-9)

These modules are used by every command. Build them first, with tests, before writing any command.

### Task 1: paths module

**Files:**
- Create: `bun/src/paths.ts`
- Test: `bun/tests/paths.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/paths.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ccwsRoot, workspacesDir, wsDir, envFile, lockFile, globalScopeFile, realClaudeDir } from '../src/paths.js';

describe('paths', () => {
  const origEnv = { ...process.env };
  beforeEach(() => { process.env = { ...origEnv }; });
  afterEach(() => { process.env = origEnv; });

  it('ccwsRoot defaults to $HOME/.ccws', () => {
    process.env.HOME = '/tmp/h';
    delete process.env.CCWS_ROOT;
    expect(ccwsRoot()).toBe('/tmp/h/.ccws');
  });

  it('ccwsRoot honors $CCWS_ROOT override', () => {
    process.env.CCWS_ROOT = '/tmp/override';
    expect(ccwsRoot()).toBe('/tmp/override');
  });

  it('workspacesDir is ccwsRoot/workspaces', () => {
    process.env.CCWS_ROOT = '/r';
    expect(workspacesDir()).toBe('/r/workspaces');
  });

  it('wsDir joins workspace name', () => {
    process.env.CCWS_ROOT = '/r';
    expect(wsDir('work')).toBe('/r/workspaces/work');
  });

  it('envFile is wsDir/ccws.env', () => {
    process.env.CCWS_ROOT = '/r';
    expect(envFile('work')).toBe('/r/workspaces/work/ccws.env');
  });

  it('lockFile is ccwsRoot/lock', () => {
    process.env.CCWS_ROOT = '/r';
    expect(lockFile()).toBe('/r/lock');
  });

  it('globalScopeFile is ccwsRoot/global', () => {
    process.env.CCWS_ROOT = '/r';
    expect(globalScopeFile()).toBe('/r/global');
  });

  it('realClaudeDir defaults to $HOME/.claude', () => {
    process.env.HOME = '/tmp/h';
    delete process.env.CCWS_REAL_CLAUDE_DIR;
    expect(realClaudeDir()).toBe('/tmp/h/.claude');
  });

  it('realClaudeDir honors $CCWS_REAL_CLAUDE_DIR override', () => {
    process.env.CCWS_REAL_CLAUDE_DIR = '/c';
    expect(realClaudeDir()).toBe('/c');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bunx vitest run tests/paths.test.ts
```

Expected: FAIL (file `src/paths.ts` does not exist).

- [ ] **Step 3: Write the module**

```typescript
// bun/src/paths.ts
import { join } from 'node:path';

function home(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? '';
}

export function ccwsRoot(): string {
  return process.env.CCWS_ROOT ?? join(home(), '.ccws');
}

export function workspacesDir(): string {
  return join(ccwsRoot(), 'workspaces');
}

export function wsDir(name: string): string {
  return join(workspacesDir(), name);
}

export function envFile(name: string): string {
  return join(wsDir(name), 'ccws.env');
}

export function lockFile(): string {
  return join(ccwsRoot(), 'lock');
}

export function globalScopeFile(): string {
  return join(ccwsRoot(), 'global');
}

export function realClaudeDir(): string {
  return process.env.CCWS_REAL_CLAUDE_DIR ?? join(home(), '.claude');
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bunx vitest run tests/paths.test.ts
```

Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add bun/src/paths.ts bun/tests/paths.test.ts
git commit -m "feat(bun): paths module — resolve ~/.ccws + ~/.claude with env overrides"
```

---

### Task 2: logger module

**Files:**
- Create: `bun/src/logger.ts`
- Test: `bun/tests/logger.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/logger.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logInfo, logWarn, logError, logOk } from '../src/logger.js';

describe('logger', () => {
  let writes: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writes = [];
    spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
  });
  afterEach(() => { spy.mockRestore(); });

  it('logInfo writes "ccws: <msg>\\n" to stderr', () => {
    logInfo('hello');
    expect(writes).toEqual(['ccws: hello\n']);
  });

  it('logWarn writes "ccws: warn: <msg>\\n"', () => {
    logWarn('careful');
    expect(writes).toEqual(['ccws: warn: careful\n']);
  });

  it('logError writes "ccws: error: <msg>\\n"', () => {
    logError('boom');
    expect(writes).toEqual(['ccws: error: boom\n']);
  });

  it('logOk writes "ccws: ok: <msg>\\n"', () => {
    logOk('done');
    expect(writes).toEqual(['ccws: ok: done\n']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/logger.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Write the module**

```typescript
// bun/src/logger.ts
function write(line: string): void {
  process.stderr.write(`${line}\n`);
}

export function logInfo(msg: string): void  { write(`ccws: ${msg}`); }
export function logWarn(msg: string): void  { write(`ccws: warn: ${msg}`); }
export function logError(msg: string): void { write(`ccws: error: ${msg}`); }
export function logOk(msg: string): void    { write(`ccws: ok: ${msg}`); }
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bunx vitest run tests/logger.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add bun/src/logger.ts bun/tests/logger.test.ts
git commit -m "feat(bun): logger module — ccws: / warn: / error: / ok: stderr lines"
```

---

### Task 3: validate module

**Files:**
- Create: `bun/src/validate.ts`
- Test: `bun/tests/validate.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/validate.test.ts
import { describe, it, expect } from 'vitest';
import { validateName } from '../src/validate.js';

describe('validateName', () => {
  it.each([
    ['work', true],
    ['my-workspace', true],
    ['team_2', true],
    ['a', true],
    ['A1', true],
    ['abc123', true],
  ])('accepts %s', (name, ok) => {
    expect(validateName(name).ok).toBe(ok);
  });

  it.each([
    ['', 'empty'],
    ['_leading', 'must be'],
    ['-leading', 'must be'],
    ['has space', 'must be'],
    ['has/slash', 'must be'],
    ['..', 'must be'],
    ['.dot', 'must be'],
    ['x'.repeat(65), 'too long'],
  ])('rejects %s', (name, reason) => {
    const r = validateName(name);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain(reason);
  });

  it.each([
    'add', 'init', 'list', 'use', 'unset', 'current', 'rm', 'sync',
    'doctor', 'tui', 'none', 'default-tui', 'local', 'global', 'which', 'hook',
  ])('rejects reserved name %s', (name) => {
    const r = validateName(name);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('reserved');
  });

  it('rejects double-dash prefixed names', () => {
    const r = validateName('--help');
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/validate.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/validate.ts
const RESERVED = new Set([
  'add', 'init', 'list', 'use', 'unset', 'current', 'rm', 'sync',
  'doctor', 'tui', 'none', 'default-tui', 'local', 'global', 'which', 'hook',
]);

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateName(name: string): ValidationResult {
  if (name === '') return { ok: false, reason: 'workspace name cannot be empty' };
  if (name.length > 64) return { ok: false, reason: 'workspace name too long (max 64 chars)' };
  if (name.startsWith('--')) return { ok: false, reason: "'" + name + "' is a reserved name" };
  if (!NAME_RE.test(name)) return { ok: false, reason: 'workspace name must be [A-Za-z0-9_-]+' };
  if (RESERVED.has(name)) return { ok: false, reason: "'" + name + "' is a reserved name" };
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bunx vitest run tests/validate.test.ts
```

Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add bun/src/validate.ts bun/tests/validate.test.ts
git commit -m "feat(bun): validateName — mirror of bash ccws_validate_name"
```

---

### Task 4: shell quoting

**Files:**
- Create: `bun/src/shellQuote.ts`
- Test: `bun/tests/shellQuote.test.ts`

Why: `ccws use` must emit lines that `eval` runs identically in bash and zsh. Bash's `printf '%q'` is the reference. We don't need to be bit-equivalent — we need *eval-equivalent*. Single-quote wrap + escape `'` is the safe POSIX form and is what we use.

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/shellQuote.test.ts
import { describe, it, expect } from 'vitest';
import { shQuote } from '../src/shellQuote.js';

describe('shQuote', () => {
  it('quotes empty string', () => {
    expect(shQuote('')).toBe("''");
  });

  it('quotes simple alphanumeric', () => {
    expect(shQuote('abc123')).toBe("'abc123'");
  });

  it('quotes strings with spaces', () => {
    expect(shQuote('hello world')).toBe("'hello world'");
  });

  it('escapes single quotes via end-quote, escaped-quote, reopen', () => {
    expect(shQuote("it's")).toBe("'it'\\''s'");
  });

  it('quotes shell metacharacters safely', () => {
    expect(shQuote('$(rm -rf /)')).toBe("'$(rm -rf /)'");
    expect(shQuote('`echo`')).toBe("'`echo`'");
    expect(shQuote('a;b|c&d')).toBe("'a;b|c&d'");
  });

  it('quotes URLs verbatim', () => {
    expect(shQuote('https://api.anthropic.com')).toBe("'https://api.anthropic.com'");
  });

  it('round-trips through bash eval', async () => {
    const values = ['', 'abc', "it's", '$(echo bad)', 'a b c', '\\nliteral'];
    for (const v of values) {
      const quoted = shQuote(v);
      const proc = Bun.spawn({
        cmd: ['bash', '-c', `printf '%s' ${quoted}`],
        stdout: 'pipe',
      });
      const out = await new Response(proc.stdout).text();
      expect(out).toBe(v);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/shellQuote.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/shellQuote.ts
export function shQuote(value: string): string {
  if (value === '') return "''";
  // Wrap in single quotes, replace each ' with '\''
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bunx vitest run tests/shellQuote.test.ts
```

Expected: all passed (including the round-trip via real bash).

- [ ] **Step 5: Commit**

```bash
git add bun/src/shellQuote.ts bun/tests/shellQuote.test.ts
git commit -m "feat(bun): shQuote — POSIX single-quote escape for eval-able exports"
```

---

### Task 5: scope module

**Files:**
- Create: `bun/src/scope.ts`
- Test: `bun/tests/scope.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/scope.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findLocalFile, readScopeFile, resolveScope } from '../src/scope.js';

describe('scope', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let origCwd: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-scope-'));
    origCwd = process.cwd();
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    mkdirSync(process.env.CCWS_ROOT, { recursive: true });
  });
  afterEach(() => {
    process.chdir(origCwd);
    rmSync(tmp, { recursive: true, force: true });
    process.env = origEnv;
  });

  it('findLocalFile returns null when no .ccws-workspace exists', () => {
    mkdirSync(join(tmp, 'proj/sub'), { recursive: true });
    expect(findLocalFile(join(tmp, 'proj/sub'))).toBe(null);
  });

  it('findLocalFile walks upward to find .ccws-workspace', () => {
    mkdirSync(join(tmp, 'proj/sub/deeper'), { recursive: true });
    writeFileSync(join(tmp, 'proj/.ccws-workspace'), 'work\n');
    expect(findLocalFile(join(tmp, 'proj/sub/deeper'))).toBe(join(tmp, 'proj/.ccws-workspace'));
  });

  it('readScopeFile returns first non-blank stripped line', () => {
    const f = join(tmp, 's');
    writeFileSync(f, '  work \n\nignored\n');
    expect(readScopeFile(f)).toBe('work');
  });

  it('readScopeFile returns null for empty / whitespace-only', () => {
    const f = join(tmp, 's');
    writeFileSync(f, '   \n');
    expect(readScopeFile(f)).toBe(null);
  });

  it('resolveScope prefers shell env CCWS_NAME', () => {
    process.env.CCWS_NAME = 'shellws';
    writeFileSync(join(process.env.CCWS_ROOT!, 'global'), 'globalws\n');
    expect(resolveScope()).toEqual({ name: 'shellws', source: 'shell' });
  });

  it('resolveScope falls back to .ccws-workspace when CCWS_NAME unset', () => {
    delete process.env.CCWS_NAME;
    mkdirSync(join(tmp, 'proj'), { recursive: true });
    writeFileSync(join(tmp, 'proj/.ccws-workspace'), 'localws\n');
    process.chdir(join(tmp, 'proj'));
    expect(resolveScope()).toEqual({ name: 'localws', source: `local:${join(tmp, 'proj/.ccws-workspace')}` });
  });

  it('resolveScope falls back to global file when no shell + no local', () => {
    delete process.env.CCWS_NAME;
    writeFileSync(join(process.env.CCWS_ROOT!, 'global'), 'globalws\n');
    process.chdir(tmp);
    expect(resolveScope()).toEqual({ name: 'globalws', source: 'global' });
  });

  it('resolveScope returns null when nothing resolves', () => {
    delete process.env.CCWS_NAME;
    process.chdir(tmp);
    expect(resolveScope()).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/scope.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/scope.ts
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { globalScopeFile } from './paths.js';

const LOCAL_MARKER = '.ccws-workspace';

export function findLocalFile(startDir: string = process.cwd()): string | null {
  let d = startDir;
  while (d && d !== '/') {
    const candidate = join(d, LOCAL_MARKER);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  const rootCandidate = join('/', LOCAL_MARKER);
  if (existsSync(rootCandidate)) return rootCandidate;
  return null;
}

export function readScopeFile(path: string): string | null {
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.replace(/\s+/g, '');
    if (trimmed !== '') return trimmed;
  }
  return null;
}

export interface ResolvedScope {
  name: string;
  source: 'shell' | 'global' | `local:${string}`;
}

export function resolveScope(): ResolvedScope | null {
  const shellName = process.env.CCWS_NAME;
  if (shellName && shellName !== '') {
    return { name: shellName, source: 'shell' };
  }
  const localFile = findLocalFile();
  if (localFile) {
    const name = readScopeFile(localFile);
    if (name) return { name, source: `local:${localFile}` };
  }
  const gf = globalScopeFile();
  const globalName = readScopeFile(gf);
  if (globalName) return { name: globalName, source: 'global' };
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bunx vitest run tests/scope.test.ts
```

Expected: 8 passed.

- [ ] **Step 5: Commit**

```bash
git add bun/src/scope.ts bun/tests/scope.test.ts
git commit -m "feat(bun): scope — pyenv-style local/global workspace resolution"
```

---

### Task 6: symlink farm

**Files:**
- Create: `bun/src/symlinkFarm.ts`
- Test: `bun/tests/symlinkFarm.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/symlinkFarm.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync, lstatSync, readlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SHARED_ITEMS, farmCreate, farmVerify, farmSync } from '../src/symlinkFarm.js';

describe('symlinkFarm', () => {
  let tmp: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-farm-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    process.env.CCWS_REAL_CLAUDE_DIR = join(tmp, '.claude');
    mkdirSync(join(tmp, '.claude/commands'), { recursive: true });
    writeFileSync(join(tmp, '.claude/settings.json'), '{}');
    mkdirSync(join(tmp, '.claude/plugins'), { recursive: true });
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    process.env = origEnv;
  });

  it('SHARED_ITEMS lists the bash inventory exactly', () => {
    expect(SHARED_ITEMS).toEqual([
      'settings.json',
      'settings.local.json',
      'CLAUDE.md',
      'commands',
      'mcp.json',
      'hooks.json',
      'hooks',
      'plugins',
      'skills',
    ]);
  });

  it('farmCreate symlinks every existing item', () => {
    farmCreate('work');
    const ws = join(process.env.CCWS_ROOT!, 'workspaces/work');
    expect(lstatSync(join(ws, 'settings.json')).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(ws, 'commands')).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(ws, 'plugins')).isSymbolicLink()).toBe(true);
    expect(existsSync(join(ws, 'CLAUDE.md'))).toBe(false); // not present in real .claude
  });

  it('farmCreate is idempotent', () => {
    farmCreate('work');
    farmCreate('work');
    const ws = join(process.env.CCWS_ROOT!, 'workspaces/work');
    expect(readlinkSync(join(ws, 'settings.json'))).toBe(join(tmp, '.claude/settings.json'));
  });

  it('farmCreate replaces an existing real directory at the target', () => {
    const ws = join(process.env.CCWS_ROOT!, 'workspaces/work');
    mkdirSync(join(ws, 'plugins'), { recursive: true });
    writeFileSync(join(ws, 'plugins/junk.txt'), 'old');
    farmCreate('work');
    expect(lstatSync(join(ws, 'plugins')).isSymbolicLink()).toBe(true);
  });

  it('farmVerify returns true when all links resolve', () => {
    farmCreate('work');
    expect(farmVerify('work').ok).toBe(true);
  });

  it('farmVerify reports broken links', () => {
    farmCreate('work');
    rmSync(join(tmp, '.claude/settings.json'));
    const r = farmVerify('work');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.broken.some((p) => p.endsWith('/settings.json'))).toBe(true);
    }
  });

  it('farmSync drops broken links and re-creates new ones', () => {
    farmCreate('work');
    // Break one link
    rmSync(join(tmp, '.claude/settings.json'));
    // Add a new item in real .claude
    writeFileSync(join(tmp, '.claude/CLAUDE.md'), '# hi');
    farmSync('work');
    const ws = join(process.env.CCWS_ROOT!, 'workspaces/work');
    expect(existsSync(join(ws, 'settings.json'))).toBe(false);
    expect(lstatSync(join(ws, 'CLAUDE.md')).isSymbolicLink()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/symlinkFarm.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/symlinkFarm.ts
import {
  existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, statSync, symlinkSync, unlinkSync,
} from 'node:fs';
import { join } from 'node:path';
import { realClaudeDir, wsDir } from './paths.js';

export const SHARED_ITEMS = [
  'settings.json',
  'settings.local.json',
  'CLAUDE.md',
  'commands',
  'mcp.json',
  'hooks.json',
  'hooks',
  'plugins',
  'skills',
] as const;

function isSymlink(p: string): boolean {
  try { return lstatSync(p).isSymbolicLink(); } catch { return false; }
}

function isRealDir(p: string): boolean {
  try {
    const st = lstatSync(p);
    return st.isDirectory() && !st.isSymbolicLink();
  } catch { return false; }
}

function linkOk(p: string): boolean {
  try { return existsSync(p); } catch { return false; }
}

export function farmCreate(name: string): void {
  const ws = wsDir(name);
  const src = realClaudeDir();
  mkdirSync(ws, { recursive: true });
  for (const item of SHARED_ITEMS) {
    const source = join(src, item);
    const target = join(ws, item);
    if (!existsSync(source) && !isSymlink(source)) continue;
    if (isRealDir(target)) rmSync(target, { recursive: true, force: true });
    if (isSymlink(target)) unlinkSync(target);
    symlinkSync(source, target);
  }
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; broken: string[] };

export function farmVerify(name: string): VerifyResult {
  const ws = wsDir(name);
  const broken: string[] = [];
  for (const item of SHARED_ITEMS) {
    const p = join(ws, item);
    if (isSymlink(p) && !linkOk(p)) broken.push(p);
  }
  return broken.length === 0 ? { ok: true } : { ok: false, broken };
}

export function farmSync(name: string): void {
  const ws = wsDir(name);
  const src = realClaudeDir();
  // Drop broken links
  for (const item of SHARED_ITEMS) {
    const p = join(ws, item);
    if (isSymlink(p) && !linkOk(p)) unlinkSync(p);
  }
  // Re-create everything that exists in src
  farmCreate(name);
  // Drop links whose source disappeared
  for (const item of SHARED_ITEMS) {
    const tgt = join(ws, item);
    const sp = join(src, item);
    if (isSymlink(tgt) && !existsSync(sp) && !isSymlink(sp)) unlinkSync(tgt);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bunx vitest run tests/symlinkFarm.test.ts
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add bun/src/symlinkFarm.ts bun/tests/symlinkFarm.test.ts
git commit -m "feat(bun): symlinkFarm — create/verify/sync shared ~/.claude links"
```

---

### Task 7: lock module

**Files:**
- Create: `bun/src/lock.ts`
- Test: `bun/tests/lock.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/lock.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { withLock } from '../src/lock.js';

describe('withLock', () => {
  let tmp: string;
  const origEnv = { ...process.env };

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-lock-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    mkdirSync(process.env.CCWS_ROOT, { recursive: true });
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    process.env = origEnv;
  });

  it('runs the callback and returns its value', async () => {
    const result = await withLock(2, async () => 42);
    expect(result).toBe(42);
  });

  it('releases the lock so a second call succeeds', async () => {
    await withLock(2, async () => {});
    const result = await withLock(2, async () => 'second');
    expect(result).toBe('second');
  });

  it('throws when the lock cannot be acquired in time', async () => {
    const blocker = withLock(5, async () => {
      await new Promise((r) => setTimeout(r, 800));
    });
    await new Promise((r) => setTimeout(r, 50));
    await expect(withLock(0, async () => 'never')).rejects.toThrow(/lock/i);
    await blocker;
  });

  it('releases the lock even if the callback throws', async () => {
    await expect(withLock(2, async () => { throw new Error('oops'); })).rejects.toThrow('oops');
    const result = await withLock(2, async () => 'after-throw');
    expect(result).toBe('after-throw');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/lock.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/lock.ts
import { mkdirSync, rmdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { lockFile } from './paths.js';

export async function withLock<T>(timeoutSec: number, fn: () => Promise<T>): Promise<T> {
  const lf = lockFile();
  mkdirSync(dirname(lf), { recursive: true });
  const lockdir = `${lf}.d`;

  const startMs = Date.now();
  const deadlineMs = startMs + Math.max(0, timeoutSec) * 1000;
  while (true) {
    try {
      mkdirSync(lockdir);
      break;
    } catch (e) {
      if (Date.now() >= deadlineMs) {
        throw new Error(`could not acquire lock within ${timeoutSec}s (held by another ccws op)`);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  try {
    return await fn();
  } finally {
    try { rmdirSync(lockdir); } catch { /* nothing to release */ }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bunx vitest run tests/lock.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add bun/src/lock.ts bun/tests/lock.test.ts
git commit -m "feat(bun): withLock — mkdir-based advisory lock with timeout"
```

---

### Task 8: prompt module

**Files:**
- Create: `bun/src/prompt.ts`
- Test: `bun/tests/prompt.test.ts`

Why this exists as a tiny module: `add`, `init`, and `rm` all read interactive input. Centralizing makes them mockable in tests (we inject a fake reader) and keeps tty handling in one place.

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/prompt.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promptLine, promptHidden, promptYn, _setReader } from '../src/prompt.js';

describe('prompt', () => {
  let writes: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writes = [];
    spy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => {
      writes.push(String(c));
      return true;
    });
  });
  afterEach(() => { spy.mockRestore(); _setReader(null); });

  it('promptLine writes the question to stderr and returns the line', async () => {
    _setReader(async () => 'work\n');
    const r = await promptLine('Name: ');
    expect(r).toBe('work');
    expect(writes).toEqual(['Name: ']);
  });

  it('promptLine returns empty string on EOF', async () => {
    _setReader(async () => null);
    expect(await promptLine('? ')).toBe('');
  });

  it('promptHidden strips trailing newline and writes a final newline to stderr', async () => {
    _setReader(async () => 'secret\n');
    const r = await promptHidden('Token: ');
    expect(r).toBe('secret');
    expect(writes).toEqual(['Token: ', '\n']);
  });

  it('promptYn defaults to Y on empty input', async () => {
    _setReader(async () => '\n');
    expect(await promptYn('ok?', 'Y')).toBe(true);
  });

  it('promptYn defaults to N on empty input when default is N', async () => {
    _setReader(async () => '\n');
    expect(await promptYn('ok?', 'N')).toBe(false);
  });

  it.each([['y', true], ['Y', true], ['yes', true], ['n', false], ['N', false], ['no', false]])(
    'promptYn parses %s as %s',
    async (input, expected) => {
      _setReader(async () => `${input}\n`);
      expect(await promptYn('?', 'N')).toBe(expected);
    },
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/prompt.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/prompt.ts
import { createInterface } from 'node:readline';

type Reader = () => Promise<string | null>;
let injected: Reader | null = null;

export function _setReader(r: Reader | null): void { injected = r; }

async function readLine(): Promise<string | null> {
  if (injected) return injected();
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, terminal: false });
    let done = false;
    const finish = (val: string | null) => {
      if (done) return;
      done = true;
      rl.close();
      resolve(val);
    };
    rl.once('line', (line) => finish(line));
    rl.once('close', () => finish(null));
  });
}

function stripNewline(s: string): string {
  return s.replace(/\r?\n$/, '');
}

export async function promptLine(question: string): Promise<string> {
  process.stderr.write(question);
  const line = await readLine();
  if (line === null) return '';
  return stripNewline(line);
}

export async function promptHidden(question: string): Promise<string> {
  process.stderr.write(question);
  // We do not turn off echo here; the bash version uses `read -s` but in a
  // compiled binary we have to flip the tty manually. Phase 1 chose to keep
  // implementation simple — the user sees what they type. If echo-off is
  // needed later, add it via tty.setRawMode + custom char reader.
  const line = await readLine();
  process.stderr.write('\n');
  if (line === null) return '';
  return stripNewline(line);
}

export async function promptYn(question: string, defaultAnswer: 'Y' | 'N'): Promise<boolean> {
  const hint = defaultAnswer === 'Y' ? '[Y/n]' : '[y/N]';
  process.stderr.write(`${question} ${hint} `);
  const line = await readLine();
  const trimmed = (line ?? '').replace(/\r?\n$/, '').trim();
  const effective = trimmed === '' ? defaultAnswer : trimmed;
  return /^y(es)?$/i.test(effective);
}
```

NOTE: The `promptHidden` does not actually hide input. This is a known regression from bash `read -s`. The follow-up is documented in Task 23 (the `add` command); if you want true echo-off, add it there with a feature-gated tty.setRawMode path.

- [ ] **Step 4: Run test to verify it passes**

```bash
bunx vitest run tests/prompt.test.ts
```

Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add bun/src/prompt.ts bun/tests/prompt.test.ts
git commit -m "feat(bun): prompt — line/hidden/yn helpers with injectable reader for tests"
```

---

### Task 9: version constant + CLI dispatcher skeleton

**Files:**
- Create: `bun/src/version.ts`
- Create: `bun/src/cli.ts`
- Modify: `bun/src/index.ts`
- Test: `bun/tests/cli.test.ts`

The dispatcher is the seam every command plugs into. We build it now with two registered commands (`--version` and `--help`); the per-command tasks below add entries one by one. The picker stays the no-arg default.

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/cli.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatch } from '../src/cli.js';
import { VERSION } from '../src/version.js';

describe('cli.dispatch', () => {
  let stdoutWrites: string[];
  let stderrWrites: string[];
  let outSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutWrites = [];
    stderrWrites = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { stdoutWrites.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { stderrWrites.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); errSpy.mockRestore(); });

  it('--version prints the version constant', async () => {
    const code = await dispatch(['--version']);
    expect(code).toBe(0);
    expect(stdoutWrites.join('')).toBe(`ccws ${VERSION}\n`);
  });

  it('-V prints the version constant', async () => {
    const code = await dispatch(['-V']);
    expect(code).toBe(0);
    expect(stdoutWrites.join('')).toBe(`ccws ${VERSION}\n`);
  });

  it('--help prints usage to stdout and exits 0', async () => {
    const code = await dispatch(['--help']);
    expect(code).toBe(0);
    expect(stdoutWrites.join('')).toMatch(/^ccws — /);
    expect(stdoutWrites.join('')).toMatch(/Usage:/);
  });

  it('unknown subcommand prints usage to stderr and exits 2', async () => {
    const code = await dispatch(['nonsense']);
    expect(code).toBe(2);
    expect(stderrWrites.join('')).toMatch(/unknown command: nonsense/);
  });

  it('no args returns sentinel PICKER for the entry point to render', async () => {
    const code = await dispatch([]);
    expect(code).toBe(-1); // -1 = "run the picker"; index.ts handles this branch
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/cli.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the version + dispatcher**

```typescript
// bun/src/version.ts
export const VERSION = '0.7.0';
```

```typescript
// bun/src/cli.ts
import { logError } from './logger.js';
import { VERSION } from './version.js';

export const PICKER_SENTINEL = -1;

const USAGE = `ccws — Claude Code WorkSpace · per-shell environment switcher

Usage:
  ccws                       Open interactive TUI picker
  ccws init                  First-time setup wizard
  ccws add [<name>]          Create a workspace (interactive if no args)
                             [--base-url URL] [--token TOK] [--binary PATH]
                             [--proxy URL] [--description DESC]
  ccws use <name>            Activate workspace in current shell
  ccws unset                 Deactivate workspace in current shell
  ccws local <name>          Set .ccws-workspace in $PWD
  ccws local --unset         Remove .ccws-workspace from $PWD
  ccws global <name>         Set user-default workspace
  ccws global --unset        Clear user-default
  ccws which [--explain]     Resolve the active workspace
  ccws hook --shell zsh      Emit init code (eval in ~/.zshrc)
  ccws hook --claude         Emit claude() wrapper (opt-in)
  ccws list [--verbose]      List all workspaces
  ccws current [--path]      Show currently active workspace
  ccws rm <name> [-f]        Remove workspace
  ccws doctor                Run health checks
  ccws sync [<name>]         Re-link symlinks
  ccws --no-tui              Bypass TUI when called without args
  ccws --help                Show this help

For 'use'/'unset' to affect your current shell, source share/init.sh
(or share/init.fish for fish) in your rc.

First time? Run: ccws init
`;

type Handler = (argv: string[]) => Promise<number>;

const handlers: Record<string, Handler> = {};

export function registerCommand(name: string, fn: Handler): void {
  handlers[name] = fn;
}

export async function dispatch(argv: string[]): Promise<number> {
  let noTui = false;
  let rest = argv;
  if (rest[0] === '--no-tui') { noTui = true; rest = rest.slice(1); }

  const cmd = rest[0];
  if (cmd === undefined) {
    if (noTui) {
      process.stdout.write(USAGE);
      return 0;
    }
    return PICKER_SENTINEL;
  }
  if (cmd === '--help' || cmd === '-h') {
    process.stdout.write(USAGE);
    return 0;
  }
  if (cmd === '--version' || cmd === '-V') {
    process.stdout.write(`ccws ${VERSION}\n`);
    return 0;
  }
  const h = handlers[cmd];
  if (!h) {
    process.stderr.write(USAGE);
    logError(`unknown command: ${cmd}`);
    return 2;
  }
  return h(rest.slice(1));
}
```

```typescript
// bun/src/index.ts
#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { App } from './picker/App.js';
import { scanWorkspaces, defaultWorkspacesDir } from './workspace.js';
import type { LogoGateInputs } from './logoData.js';
import { dispatch, PICKER_SENTINEL } from './cli.js';

function gateInputs(): LogoGateInputs {
  return {
    envNoLogo: process.env.CCWS_NO_LOGO,
    stderrIsTTY: Boolean(process.stderr.isTTY),
    cols: process.stdout.columns ?? 80,
    lines: process.stdout.rows ?? 24,
  };
}

async function runPicker(): Promise<number> {
  const workspacesDir = defaultWorkspacesDir();
  const initial = scanWorkspaces({ workspacesDir, activeName: process.env.CCWS_NAME ?? null });
  if (initial.length === 0) {
    process.stderr.write("ccws: warn: no workspaces — run 'ccws add <name>'\n");
    return 1;
  }

  return new Promise<number>((resolve) => {
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
          resolve(exitCode);
        },
      }),
      { stdout: process.stderr, exitOnCtrlC: false },
    );
    inkInstance.waitUntilExit().catch(() => resolve(1));
  });
}

async function main(): Promise<void> {
  const code = await dispatch(process.argv.slice(2));
  if (code === PICKER_SENTINEL) {
    process.exit(await runPicker());
  }
  process.exit(code);
}

void main();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bunx vitest run tests/cli.test.ts
```

Expected: 5 passed.

- [ ] **Step 5: Sanity check the picker still runs**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run src/index.ts --version
# Expected: ccws 0.7.0
bun run src/index.ts --help | head -2
# Expected: ccws — Claude Code WorkSpace · per-shell environment switcher
```

- [ ] **Step 6: Commit**

```bash
git add bun/src/version.ts bun/src/cli.ts bun/src/index.ts bun/tests/cli.test.ts
git commit -m "feat(bun): CLI dispatcher with --help/--version + picker sentinel"
```

---

## Phase B — Read-only commands (Tasks 10-15)

Start with the commands that only read state. They prove the dispatcher + shared modules without risking data loss. Each one ends with the command wired into `cli.ts` AND the corresponding `lib/cmd_*.sh` stays in place — bash dispatcher still uses the bash versions; the TS versions are only reachable when the binary itself is invoked (which only happens after Task 36's install rewrite, or when run manually via `bun run src/index.ts <cmd>`).

### Task 10: use command

**Files:**
- Create: `bun/src/commands/use.ts`
- Modify: `bun/src/cli.ts`
- Test: `bun/tests/commands/use.test.ts`

This is the most behavior-critical command — `share/init.sh` evals its stdout. Reference: bash impl at `/Users/kola/workspace/ccws/lib/cmd_use.sh`.

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/commands/use.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runUse } from '../../src/commands/use.js';

describe('runUse', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let stdoutWrites: string[];
  let stderrWrites: string[];
  let outSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-use-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    mkdirSync(join(tmp, '.ccws/workspaces/work'), { recursive: true });
    stdoutWrites = []; stderrWrites = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { stdoutWrites.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { stderrWrites.push(String(c)); return true; });
  });
  afterEach(() => {
    outSpy.mockRestore(); errSpy.mockRestore();
    rmSync(tmp, { recursive: true, force: true });
    process.env = origEnv;
  });

  function out(): string { return stdoutWrites.join(''); }

  it('exits 2 with bad name', async () => {
    expect(await runUse(['has space'])).toBe(2);
  });

  it('exits 1 when workspace dir missing', async () => {
    expect(await runUse(['nonexistent'])).toBe(1);
    expect(stderrWrites.join('')).toContain('workspace not found');
  });

  it('always exports CCWS_NAME, CCWS_REAL_HOME, CLAUDE_CONFIG_DIR', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'), 'CCWS_NAME=work\nCCWS_CREATED=2026-01-01T00:00:00Z\n');
    process.env.HOME = '/home/me';
    expect(await runUse(['work'])).toBe(0);
    const lines = out().split('\n');
    expect(lines).toContain(`export CCWS_NAME='work'`);
    expect(lines).toContain(`export CCWS_REAL_HOME='/home/me'`);
    expect(lines).toContain(`export CLAUDE_CONFIG_DIR='${join(tmp, '.ccws/workspaces/work')}'`);
  });

  it('exports ANTHROPIC_* and CLAUDE_* keys verbatim', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nANTHROPIC_BASE_URL=https://api.anthropic.com\nANTHROPIC_AUTH_TOKEN=sk-123\nCLAUDE_CODE_EFFORT_LEVEL=high\n');
    expect(await runUse(['work'])).toBe(0);
    expect(out()).toContain(`export ANTHROPIC_BASE_URL='https://api.anthropic.com'`);
    expect(out()).toContain(`export ANTHROPIC_AUTH_TOKEN='sk-123'`);
    expect(out()).toContain(`export CLAUDE_CODE_EFFORT_LEVEL='high'`);
  });

  it('skips internal metadata keys CCWS_NAME / CCWS_CREATED / CCWS_DESCRIPTION', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nCCWS_CREATED=2026-01-01T00:00:00Z\nCCWS_DESCRIPTION=team workspace\n');
    expect(await runUse(['work'])).toBe(0);
    // CCWS_NAME export comes from the always-emit block (not the env loop),
    // and is emitted exactly once.
    const matches = out().match(/export CCWS_NAME=/g) ?? [];
    expect(matches.length).toBe(1);
    expect(out()).not.toContain(`export CCWS_CREATED=`);
    expect(out()).not.toContain(`export CCWS_DESCRIPTION=`);
  });

  it('exports CCWS_BINARY and prepends its dirname to PATH', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nCCWS_BINARY=/opt/claude/bin/claude\n');
    process.env.PATH = '/usr/bin';
    expect(await runUse(['work'])).toBe(0);
    expect(out()).toContain(`export CCWS_BINARY='/opt/claude/bin/claude'`);
    expect(out()).toContain(`export PATH='/opt/claude/bin:/usr/bin'`);
  });

  it('exports both upper and lower case proxy vars', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nHTTPS_PROXY=http://p:7890\nhttps_proxy=http://p:7890\nHTTP_PROXY=http://p:7890\nhttp_proxy=http://p:7890\n');
    expect(await runUse(['work'])).toBe(0);
    expect(out()).toContain(`export HTTPS_PROXY=`);
    expect(out()).toContain(`export https_proxy=`);
    expect(out()).toContain(`export HTTP_PROXY=`);
    expect(out()).toContain(`export http_proxy=`);
  });

  it('skips keys not on the allowlist', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nRANDOM_KEY=ignored\nFOO_BAR=also-ignored\n');
    expect(await runUse(['work'])).toBe(0);
    expect(out()).not.toContain(`RANDOM_KEY`);
    expect(out()).not.toContain(`FOO_BAR`);
  });

  it('emits CCWS_EXPORTED as a comma-separated list (unquoted) as the last export', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      'CCWS_NAME=work\nANTHROPIC_BASE_URL=https://x\n');
    expect(await runUse(['work'])).toBe(0);
    const lines = out().trimEnd().split('\n');
    const last = lines[lines.length - 1]!;
    expect(last).toMatch(/^export CCWS_EXPORTED=[A-Z_,]+$/);
    expect(last).toContain('CCWS_NAME');
    expect(last).toContain('CCWS_REAL_HOME');
    expect(last).toContain('CLAUDE_CONFIG_DIR');
    expect(last).toContain('ANTHROPIC_BASE_URL');
    // unquoted (so fish's parser doesn't break on quotes around commas)
    expect(last).not.toContain(`'`);
  });

  it('stdout output is eval-able by bash and sets the expected vars', async () => {
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'),
      "CCWS_NAME=work\nANTHROPIC_AUTH_TOKEN=sk's-tricky\n");
    expect(await runUse(['work'])).toBe(0);
    const captured = out();
    const proc = Bun.spawn({
      cmd: ['bash', '-c', `${captured}\nprintf '%s\\n' "$CCWS_NAME" "$ANTHROPIC_AUTH_TOKEN"`],
      stdout: 'pipe',
    });
    const text = await new Response(proc.stdout).text();
    expect(text).toBe(`work\nsk's-tricky\n`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bunx vitest run tests/commands/use.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/commands/use.ts
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { envFile, wsDir } from '../paths.js';
import { parseEnvFile } from '../env.js';
import { validateName } from '../validate.js';
import { logError } from '../logger.js';
import { shQuote } from '../shellQuote.js';

const INTERNAL_META = new Set(['CCWS_NAME', 'CCWS_CREATED', 'CCWS_DESCRIPTION']);
const PROXY_KEYS_BOTH_CASES = new Set([
  'HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY', 'NO_PROXY',
  'https_proxy', 'http_proxy', 'all_proxy', 'no_proxy',
]);

function isAllowed(key: string): boolean {
  if (INTERNAL_META.has(key)) return false;
  if (key === 'CCWS_BINARY') return true;
  if (key.startsWith('ANTHROPIC_')) return true;
  if (key.startsWith('CLAUDE_')) return true;
  if (key.startsWith('CCWS_')) return true;
  if (PROXY_KEYS_BOTH_CASES.has(key)) return true;
  return false;
}

export async function runUse(argv: string[]): Promise<number> {
  const name = argv[0];
  if (name === undefined) {
    logError('usage: ccws use <name>');
    return 2;
  }
  const v = validateName(name);
  if (!v.ok) {
    logError(v.reason);
    return 2;
  }
  const ws = wsDir(name);
  if (!existsSync(ws)) {
    logError(`workspace not found: ${name}`);
    return 1;
  }

  const exportedKeys: string[] = ['CCWS_NAME', 'CCWS_REAL_HOME', 'CLAUDE_CONFIG_DIR'];
  const lines: string[] = [];
  lines.push(`export CCWS_NAME=${shQuote(name)}`);
  lines.push(`export CCWS_REAL_HOME=${shQuote(process.env.HOME ?? '')}`);
  lines.push(`export CLAUDE_CONFIG_DIR=${shQuote(ws)}`);

  const env = parseEnvFile(envFile(name));
  for (const [key, value] of Object.entries(env)) {
    if (!isAllowed(key)) continue;
    if (key === 'CCWS_BINARY') {
      lines.push(`export CCWS_BINARY=${shQuote(value)}`);
      const newPath = `${dirname(value)}:${process.env.PATH ?? ''}`;
      lines.push(`export PATH=${shQuote(newPath)}`);
      exportedKeys.push('CCWS_BINARY', 'PATH');
      continue;
    }
    lines.push(`export ${key}=${shQuote(value)}`);
    exportedKeys.push(key);
  }

  // Unquoted CCWS_EXPORTED — keys are validated identifiers, no escaping needed,
  // and bash %q would escape the commas which breaks the fish wrapper parser.
  lines.push(`export CCWS_EXPORTED=${exportedKeys.join(',')}`);

  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}
```

- [ ] **Step 4: Wire it into `cli.ts`**

Add at the bottom of `bun/src/cli.ts` (just before the existing `export async function dispatch`):

```typescript
import { runUse } from './commands/use.js';
registerCommand('use', runUse);
```

Move the `import` to the top of the file with the others; the `registerCommand` call stays at module scope. (Hoisting matters — the `dispatch` invocation must run after registration.)

- [ ] **Step 5: Run tests**

```bash
bunx vitest run tests/commands/use.test.ts tests/cli.test.ts
```

Expected: all passed (the new tests + the dispatcher tests still pass).

- [ ] **Step 6: Manual smoke test**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run src/index.ts use gradient
```

Expected: stdout contains `export CCWS_NAME='gradient'` and an `export CCWS_EXPORTED=...` line.

- [ ] **Step 7: Commit**

```bash
git add bun/src/commands/use.ts bun/src/cli.ts bun/tests/commands/use.test.ts
git commit -m "feat(bun): ccws use — emit eval-able export lines, mirror bash protocol"
```

---

### Task 11: unset command

**Files:**
- Create: `bun/src/commands/unset.ts`
- Modify: `bun/src/cli.ts`
- Test: `bun/tests/commands/unset.test.ts`

Reference: bash impl at `lib/cmd_unset.sh`. Reads `CCWS_EXPORTED` from `process.env`, emits one `unset KEY` line per name, plus a final `unset CCWS_EXPORTED`. Falls back to a hardcoded list when `CCWS_EXPORTED` is absent (back-compat for shells that pre-date the tracking var).

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/commands/unset.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runUnset } from '../../src/commands/unset.js';

describe('runUnset', () => {
  const origEnv = { ...process.env };
  let stdoutWrites: string[];
  let outSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env = { ...origEnv };
    stdoutWrites = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { stdoutWrites.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); process.env = origEnv; });

  function out(): string { return stdoutWrites.join(''); }

  it('falls back to a hardcoded list when CCWS_EXPORTED is unset', async () => {
    delete process.env.CCWS_EXPORTED;
    expect(await runUnset([])).toBe(0);
    const lines = out().trimEnd().split('\n');
    expect(lines).toEqual([
      'unset CCWS_NAME',
      'unset CCWS_REAL_HOME',
      'unset CLAUDE_CONFIG_DIR',
      'unset ANTHROPIC_BASE_URL',
      'unset ANTHROPIC_AUTH_TOKEN',
      'unset CCWS_BINARY',
      'unset CCWS_EXPORTED',
    ]);
  });

  it('reads CCWS_EXPORTED and emits unset for each name + a final unset CCWS_EXPORTED', async () => {
    process.env.CCWS_EXPORTED = 'CCWS_NAME,ANTHROPIC_BASE_URL,HTTPS_PROXY';
    expect(await runUnset([])).toBe(0);
    expect(out().trimEnd().split('\n')).toEqual([
      'unset CCWS_NAME',
      'unset ANTHROPIC_BASE_URL',
      'unset HTTPS_PROXY',
      'unset CCWS_EXPORTED',
    ]);
  });

  it('skips invalid identifiers in CCWS_EXPORTED (injection defense)', async () => {
    process.env.CCWS_EXPORTED = 'CCWS_NAME,bad name,$(rm),OK';
    expect(await runUnset([])).toBe(0);
    expect(out().trimEnd().split('\n')).toEqual([
      'unset CCWS_NAME',
      'unset OK',
      'unset CCWS_EXPORTED',
    ]);
  });

  it('emits only the final CCWS_EXPORTED line when CCWS_EXPORTED is empty', async () => {
    process.env.CCWS_EXPORTED = '';
    // empty string is treated as "set but no names" — fall back to hardcoded list
    expect(await runUnset([])).toBe(0);
    expect(out().trimEnd().split('\n')[0]).toBe('unset CCWS_NAME');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/commands/unset.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/commands/unset.ts
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const FALLBACK = [
  'CCWS_NAME',
  'CCWS_REAL_HOME',
  'CLAUDE_CONFIG_DIR',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'CCWS_BINARY',
];

export async function runUnset(_argv: string[]): Promise<number> {
  const tracked = process.env.CCWS_EXPORTED ?? '';
  const lines: string[] = [];
  if (tracked === '') {
    for (const k of FALLBACK) lines.push(`unset ${k}`);
  } else {
    for (const k of tracked.split(',')) {
      const trimmed = k.trim();
      if (!KEY_RE.test(trimmed)) continue;
      lines.push(`unset ${trimmed}`);
    }
  }
  lines.push('unset CCWS_EXPORTED');
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}
```

- [ ] **Step 4: Wire it into `cli.ts`**

Add to imports + registrations in `bun/src/cli.ts`:

```typescript
import { runUnset } from './commands/unset.js';
registerCommand('unset', runUnset);
```

- [ ] **Step 5: Run tests**

```bash
bunx vitest run tests/commands/unset.test.ts
```

Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add bun/src/commands/unset.ts bun/src/cli.ts bun/tests/commands/unset.test.ts
git commit -m "feat(bun): ccws unset — emit eval-able unset lines"
```

---

### Task 12: list command

**Files:**
- Create: `bun/src/commands/list.ts`
- Modify: `bun/src/cli.ts`
- Test: `bun/tests/commands/list.test.ts`

Reference: bash impl at `lib/cmd_list.sh`. Plain: `<marker> <name>\n`. Verbose: `<marker> <name>  endpoint=<base-url|"anthropic">  created=<CCWS_CREATED|"?">\n`. Marker is `*` for the active workspace, `' '` otherwise.

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/commands/list.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runList } from '../../src/commands/list.js';

describe('runList', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let stdoutWrites: string[];
  let stderrWrites: string[];
  let outSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-list-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    delete process.env.CCWS_NAME;
    stdoutWrites = []; stderrWrites = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { stdoutWrites.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { stderrWrites.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); errSpy.mockRestore(); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('prints info to stderr and exits 0 when workspaces dir missing', async () => {
    expect(await runList([])).toBe(0);
    expect(stderrWrites.join('')).toContain("no workspaces yet — run 'ccws add <name>'");
  });

  it('plain mode prints " <name>" per workspace', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/alpha'), { recursive: true });
    mkdirSync(join(tmp, '.ccws/workspaces/beta'), { recursive: true });
    expect(await runList([])).toBe(0);
    expect(stdoutWrites.join('').split('\n').filter(Boolean).sort()).toEqual([' alpha', ' beta']);
  });

  it('marks active workspace with *', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/alpha'), { recursive: true });
    mkdirSync(join(tmp, '.ccws/workspaces/beta'), { recursive: true });
    process.env.CCWS_NAME = 'beta';
    expect(await runList([])).toBe(0);
    const lines = stdoutWrites.join('').split('\n').filter(Boolean).sort();
    expect(lines).toEqual([' alpha', '* beta']);
  });

  it('verbose mode prints endpoint + created columns', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/alpha'), { recursive: true });
    writeFileSync(join(tmp, '.ccws/workspaces/alpha/ccws.env'),
      'CCWS_NAME=alpha\nCCWS_CREATED=2026-01-01T00:00:00Z\nANTHROPIC_BASE_URL=https://x\n');
    expect(await runList(['--verbose'])).toBe(0);
    expect(stdoutWrites.join('')).toContain(' alpha  endpoint=https://x  created=2026-01-01T00:00:00Z');
  });

  it('verbose mode defaults endpoint to "anthropic" and created to "?" when missing', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/alpha'), { recursive: true });
    writeFileSync(join(tmp, '.ccws/workspaces/alpha/ccws.env'), 'CCWS_NAME=alpha\n');
    expect(await runList(['-v'])).toBe(0);
    expect(stdoutWrites.join('')).toContain(' alpha  endpoint=anthropic  created=?');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/commands/list.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/commands/list.ts
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { envFile, workspacesDir } from '../paths.js';
import { parseEnvFile } from '../env.js';
import { logInfo } from '../logger.js';

export async function runList(argv: string[]): Promise<number> {
  const verbose = argv[0] === '--verbose' || argv[0] === '-v';
  const dir = workspacesDir();
  if (!existsSync(dir)) {
    logInfo("no workspaces yet — run 'ccws add <name>'");
    return 0;
  }
  const active = process.env.CCWS_NAME ?? '';
  const entries = readdirSync(dir).filter((n) => {
    try { return statSync(join(dir, n)).isDirectory(); } catch { return false; }
  });
  if (entries.length === 0) {
    logInfo('no workspaces yet');
    return 0;
  }
  for (const name of entries) {
    const marker = name === active ? '*' : ' ';
    if (verbose) {
      const env = parseEnvFile(envFile(name));
      const endpoint = env.ANTHROPIC_BASE_URL && env.ANTHROPIC_BASE_URL !== '' ? env.ANTHROPIC_BASE_URL : 'anthropic';
      const created = env.CCWS_CREATED && env.CCWS_CREATED !== '' ? env.CCWS_CREATED : '?';
      process.stdout.write(`${marker} ${name}  endpoint=${endpoint}  created=${created}\n`);
    } else {
      process.stdout.write(`${marker} ${name}\n`);
    }
  }
  return 0;
}
```

- [ ] **Step 4: Wire into `cli.ts`**

```typescript
import { runList } from './commands/list.js';
registerCommand('list', runList);
```

- [ ] **Step 5: Run tests + smoke**

```bash
bunx vitest run tests/commands/list.test.ts
bun run src/index.ts list
bun run src/index.ts list --verbose
```

Expected: vitest passes; manual smoke shows your real workspaces (gradient, deepseek, etc.) with `*` next to whichever is currently active in this shell.

- [ ] **Step 6: Commit**

```bash
git add bun/src/commands/list.ts bun/src/cli.ts bun/tests/commands/list.test.ts
git commit -m "feat(bun): ccws list — plain + --verbose"
```

---

### Task 13: current command

**Files:**
- Create: `bun/src/commands/current.ts`
- Modify: `bun/src/cli.ts`
- Test: `bun/tests/commands/current.test.ts`

Reference: bash `lib/cmd_current.sh`. With no `CCWS_NAME`: stdout `(none) — run "ccws use <name>" to activate`, exit 0 (or exit 1 if `--path`). With `CCWS_NAME` set: `<name> (CLAUDE_CONFIG_DIR=<path>)` or just `<path>` with `--path`.

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/commands/current.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runCurrent } from '../../src/commands/current.js';

describe('runCurrent', () => {
  const origEnv = { ...process.env };
  let stdoutWrites: string[];
  let outSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    process.env = { ...origEnv };
    stdoutWrites = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { stdoutWrites.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); process.env = origEnv; });
  function out(): string { return stdoutWrites.join(''); }

  it('plain: prints (none) hint when CCWS_NAME unset, exit 0', async () => {
    delete process.env.CCWS_NAME;
    expect(await runCurrent([])).toBe(0);
    expect(out()).toBe('(none) — run "ccws use <name>" to activate\n');
  });

  it('--path: returns 1 and emits nothing when CCWS_NAME unset', async () => {
    delete process.env.CCWS_NAME;
    expect(await runCurrent(['--path'])).toBe(1);
    expect(out()).toBe('');
  });

  it('plain: prints <name> (CLAUDE_CONFIG_DIR=<path>)', async () => {
    process.env.HOME = '/h';
    process.env.CCWS_ROOT = '/h/.ccws';
    process.env.CCWS_NAME = 'work';
    process.env.CLAUDE_CONFIG_DIR = '/h/.ccws/workspaces/work';
    expect(await runCurrent([])).toBe(0);
    expect(out()).toBe('work (CLAUDE_CONFIG_DIR=/h/.ccws/workspaces/work)\n');
  });

  it('--path: prints workspace dir path', async () => {
    process.env.CCWS_ROOT = '/h/.ccws';
    process.env.CCWS_NAME = 'work';
    expect(await runCurrent(['--path'])).toBe(0);
    expect(out()).toBe('/h/.ccws/workspaces/work\n');
  });

  it('-p shorthand same as --path', async () => {
    process.env.CCWS_ROOT = '/h/.ccws';
    process.env.CCWS_NAME = 'work';
    expect(await runCurrent(['-p'])).toBe(0);
    expect(out()).toBe('/h/.ccws/workspaces/work\n');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/commands/current.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/commands/current.ts
import { wsDir } from '../paths.js';

export async function runCurrent(argv: string[]): Promise<number> {
  const pathOnly = argv[0] === '--path' || argv[0] === '-p';
  const name = process.env.CCWS_NAME ?? '';
  if (name === '') {
    if (pathOnly) return 1;
    process.stdout.write('(none) — run "ccws use <name>" to activate\n');
    return 0;
  }
  if (pathOnly) {
    process.stdout.write(`${wsDir(name)}\n`);
  } else {
    process.stdout.write(`${name} (CLAUDE_CONFIG_DIR=${process.env.CLAUDE_CONFIG_DIR ?? ''})\n`);
  }
  return 0;
}
```

- [ ] **Step 4: Wire into `cli.ts`**

```typescript
import { runCurrent } from './commands/current.js';
registerCommand('current', runCurrent);
```

- [ ] **Step 5: Run tests**

```bash
bunx vitest run tests/commands/current.test.ts
```

Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add bun/src/commands/current.ts bun/src/cli.ts bun/tests/commands/current.test.ts
git commit -m "feat(bun): ccws current — plain + --path"
```

---

### Task 14: which command

**Files:**
- Create: `bun/src/commands/which.ts`
- Modify: `bun/src/cli.ts`
- Test: `bun/tests/commands/which.test.ts`

Reference: `lib/cmd_which.sh`. Plain prints the resolved name on stdout (scriptable). `--explain` adds detail lines to **stderr**. Exit 0 when resolved, 1 when not (and `--explain` then prints why on stderr).

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/commands/which.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runWhich } from '../../src/commands/which.js';

describe('runWhich', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let origCwd: string;
  let outs: string[]; let errs: string[];
  let outSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-which-'));
    origCwd = process.cwd();
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    mkdirSync(process.env.CCWS_ROOT, { recursive: true });
    delete process.env.CCWS_NAME;
    outs = []; errs = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { outs.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); errSpy.mockRestore(); process.chdir(origCwd); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('shell scope wins and prints name on stdout', async () => {
    process.env.CCWS_NAME = 'shellws';
    expect(await runWhich([])).toBe(0);
    expect(outs.join('')).toBe('shellws\n');
  });

  it('exits 1 when nothing resolves', async () => {
    process.chdir(tmp);
    expect(await runWhich([])).toBe(1);
    expect(outs.join('')).toBe('');
  });

  it('--explain on a shell hit prints source: shell on stderr', async () => {
    process.env.CCWS_NAME = 'shellws';
    expect(await runWhich(['--explain'])).toBe(0);
    expect(errs.join('')).toContain('source: shell');
  });

  it('--explain on miss prints all three scope statuses on stderr', async () => {
    process.chdir(tmp);
    expect(await runWhich(['--explain'])).toBe(1);
    const e = errs.join('');
    expect(e).toContain('.ccws-workspace:');
    expect(e).toContain('global:');
    expect(e).toContain('CCWS_NAME:');
  });

  it('falls back to .ccws-workspace then global', async () => {
    mkdirSync(join(tmp, 'proj'), { recursive: true });
    writeFileSync(join(tmp, 'proj/.ccws-workspace'), 'localws\n');
    process.chdir(join(tmp, 'proj'));
    expect(await runWhich([])).toBe(0);
    expect(outs.join('')).toBe('localws\n');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/commands/which.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/commands/which.ts
import { existsSync } from 'node:fs';
import { findLocalFile, resolveScope } from '../scope.js';
import { globalScopeFile } from '../paths.js';
import { logError } from '../logger.js';

export async function runWhich(argv: string[]): Promise<number> {
  const explain = argv[0] === '--explain' || argv[0] === '-v';
  if (argv[0] && argv[0].startsWith('-') && !explain) {
    logError(`unknown flag: ${argv[0]}`);
    return 2;
  }
  const resolved = resolveScope();
  if (resolved) {
    process.stdout.write(`${resolved.name}\n`);
    if (explain) process.stderr.write(`  source: ${resolved.source}\n`);
    return 0;
  }
  if (explain) {
    const local = findLocalFile();
    if (local) process.stderr.write(`  .ccws-workspace: ${local} (empty)\n`);
    else process.stderr.write(`  .ccws-workspace: not found in ${process.cwd()} or parents\n`);
    const gf = globalScopeFile();
    if (existsSync(gf)) process.stderr.write(`  global:          ${gf} (empty)\n`);
    else process.stderr.write(`  global:          not set (${gf})\n`);
    process.stderr.write('  CCWS_NAME:       unset\n');
  }
  return 1;
}
```

- [ ] **Step 4: Wire into `cli.ts`**

```typescript
import { runWhich } from './commands/which.js';
registerCommand('which', runWhich);
```

- [ ] **Step 5: Run tests**

```bash
bunx vitest run tests/commands/which.test.ts
```

Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add bun/src/commands/which.ts bun/src/cli.ts bun/tests/commands/which.test.ts
git commit -m "feat(bun): ccws which — plain + --explain"
```

---

### Task 15: hook command

**Files:**
- Create: `bun/src/commands/hook.ts`
- Modify: `bun/src/cli.ts`
- Test: `bun/tests/commands/hook.test.ts`

Reference: `lib/cmd_hook.sh`. Emits `source <quoted-path>` for bash/zsh, `source <plain-path>` for fish, and an additional `source <wrapper>` line when `--claude` is given. Reads `$CCWS_DIR` to find the share/ dir. Exit 2 with usage when no args; exit 1 if a required file is missing.

The compiled binary doesn't have a `CCWS_DIR` set the way bash does. We compute a default — `dirname(process.execPath) + '/../share'` — and fall back to `$CCWS_DIR` if set. This way `ccws hook` works whether run from the source tree (`bun run`) or from an installed binary.

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/commands/hook.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runHook } from '../../src/commands/hook.js';

describe('runHook', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let outs: string[]; let errs: string[];
  let outSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-hook-'));
    process.env = { ...origEnv };
    process.env.CCWS_DIR = tmp;
    mkdirSync(join(tmp, 'share'), { recursive: true });
    writeFileSync(join(tmp, 'share/init.sh'), '');
    writeFileSync(join(tmp, 'share/init.fish'), '');
    writeFileSync(join(tmp, 'share/claude-wrapper.sh'), '');
    outs = []; errs = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { outs.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); errSpy.mockRestore(); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('returns 2 + usage when no args', async () => {
    expect(await runHook([])).toBe(2);
    expect(errs.join('')).toMatch(/Usage:/);
  });

  it('--help returns 0 and prints usage', async () => {
    expect(await runHook(['--help'])).toBe(0);
    expect(errs.join('')).toMatch(/Usage:/);
  });

  it('--shell zsh emits source <quoted path>/share/init.sh', async () => {
    expect(await runHook(['--shell', 'zsh'])).toBe(0);
    expect(outs.join('').trim()).toBe(`source '${join(tmp, 'share/init.sh')}'`);
  });

  it('--shell bash emits the same init.sh source', async () => {
    expect(await runHook(['--shell', 'bash'])).toBe(0);
    expect(outs.join('').trim()).toBe(`source '${join(tmp, 'share/init.sh')}'`);
  });

  it('--shell fish emits source <plain path>/share/init.fish', async () => {
    expect(await runHook(['--shell', 'fish'])).toBe(0);
    expect(outs.join('').trim()).toBe(`source ${join(tmp, 'share/init.fish')}`);
  });

  it('--shell zsh --claude appends the wrapper source line', async () => {
    expect(await runHook(['--shell', 'zsh', '--claude'])).toBe(0);
    const lines = outs.join('').trim().split('\n');
    expect(lines).toEqual([
      `source '${join(tmp, 'share/init.sh')}'`,
      `source '${join(tmp, 'share/claude-wrapper.sh')}'`,
    ]);
  });

  it('exits 2 on unknown shell', async () => {
    expect(await runHook(['--shell', 'tcsh'])).toBe(2);
    expect(errs.join('')).toMatch(/unsupported shell/);
  });

  it('exits 1 when share/init.sh is missing', async () => {
    rmSync(join(tmp, 'share/init.sh'));
    expect(await runHook(['--shell', 'zsh'])).toBe(1);
    expect(errs.join('')).toMatch(/init\.sh not found/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/commands/hook.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/commands/hook.ts
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { logError } from '../logger.js';
import { shQuote } from '../shellQuote.js';

function shareDir(): string {
  if (process.env.CCWS_DIR && process.env.CCWS_DIR !== '') {
    return join(process.env.CCWS_DIR, 'share');
  }
  // Compiled binary: assume binary lives in <root>/bin/ccws or <root>/bun/dist/...
  // Walk up from process.execPath until we see a sibling share/ dir.
  let d = dirname(process.execPath);
  for (let i = 0; i < 5; i++) {
    const candidate = join(d, 'share');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return resolve('share');
}

const USAGE = `Usage: ccws hook [--shell zsh|bash|fish] [--claude]

Emit shell code to eval from your rc file.

  --shell SHELL   Initialize the ccws shell function (use/unset/TUI).
                  Add to ~/.zshrc / ~/.bashrc:
                      eval "$(ccws hook --shell zsh)"
                  For fish, add to ~/.config/fish/config.fish:
                      ccws hook --shell fish | source

  --claude        Enable opt-in claude() wrapper.
                  Add to ~/.zshrc / ~/.bashrc:
                      eval "$(ccws hook --claude)"

These can be combined:
    eval "$(ccws hook --shell zsh --claude)"
`;

export async function runHook(argv: string[]): Promise<number> {
  let shell = '';
  let wantClaude = false;
  let showHelp = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--shell') { shell = argv[i + 1] ?? ''; i++; continue; }
    if (a === '--claude') { wantClaude = true; continue; }
    if (a === '-h' || a === '--help') { showHelp = true; continue; }
    logError(`unknown flag: ${a}`);
    return 2;
  }
  if (showHelp) { process.stderr.write(USAGE); return 0; }
  if (shell === '' && !wantClaude) { process.stderr.write(USAGE); return 2; }

  const share = shareDir();
  if (shell !== '') {
    if (shell === 'zsh' || shell === 'bash') {
      const p = join(share, 'init.sh');
      if (!existsSync(p)) { logError(`init.sh not found at ${p}`); return 1; }
      process.stdout.write(`source ${shQuote(p)}\n`);
    } else if (shell === 'fish') {
      const p = join(share, 'init.fish');
      if (!existsSync(p)) { logError(`init.fish not found at ${p}`); return 1; }
      process.stdout.write(`source ${p}\n`);
    } else {
      logError(`unsupported shell: ${shell} (zsh|bash|fish)`);
      return 2;
    }
  }
  if (wantClaude) {
    const p = join(share, 'claude-wrapper.sh');
    if (!existsSync(p)) { logError(`claude-wrapper.sh not found at ${p}`); return 1; }
    process.stdout.write(`source ${shQuote(p)}\n`);
  }
  return 0;
}
```

- [ ] **Step 4: Wire into `cli.ts`**

```typescript
import { runHook } from './commands/hook.js';
registerCommand('hook', runHook);
```

- [ ] **Step 5: Run tests**

```bash
bunx vitest run tests/commands/hook.test.ts
```

Expected: 8 passed.

- [ ] **Step 6: Commit**

```bash
git add bun/src/commands/hook.ts bun/src/cli.ts bun/tests/commands/hook.test.ts
git commit -m "feat(bun): ccws hook — emit source lines for shell rc + claude wrapper"
```

---

## Phase C — Scope mutators (Tasks 16-17)

Tiny commands that just touch a file. Doing them before the heavyweight mutators (add/rm/sync/init/doctor) keeps the difficulty curve smooth.

### Task 16: local command

**Files:**
- Create: `bun/src/commands/local.ts`
- Modify: `bun/src/cli.ts`
- Test: `bun/tests/commands/local.test.ts`

Reference: `lib/cmd_local.sh`. Reads / sets / removes `./.ccws-workspace`.

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/commands/local.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runLocal } from '../../src/commands/local.js';

describe('runLocal', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let origCwd: string;
  let outs: string[]; let errs: string[];
  let outSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-local-'));
    origCwd = process.cwd();
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    mkdirSync(join(tmp, '.ccws/workspaces/work'), { recursive: true });
    process.chdir(tmp);
    outs = []; errs = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { outs.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); errSpy.mockRestore(); process.chdir(origCwd); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('no args + no file: error + exit 1', async () => {
    expect(await runLocal([])).toBe(1);
    expect(errs.join('')).toMatch(/no \.ccws-workspace in/);
  });

  it('no args + file present: print name on stdout, exit 0', async () => {
    writeFileSync(join(tmp, '.ccws-workspace'), 'work\n');
    expect(await runLocal([])).toBe(0);
    expect(outs.join('')).toBe('work\n');
  });

  it('--unset removes the file with an ok log, idempotent', async () => {
    writeFileSync(join(tmp, '.ccws-workspace'), 'work\n');
    expect(await runLocal(['--unset'])).toBe(0);
    expect(existsSync(join(tmp, '.ccws-workspace'))).toBe(false);
    expect(errs.join('')).toMatch(/ok: removed/);
    // Idempotent — second call still 0, prints warn
    outs.length = 0; errs.length = 0;
    expect(await runLocal(['--unset'])).toBe(0);
    expect(errs.join('')).toMatch(/no \.ccws-workspace/);
  });

  it('positional name: writes file with name, exit 0', async () => {
    expect(await runLocal(['work'])).toBe(0);
    expect(readFileSync(join(tmp, '.ccws-workspace'), 'utf8').trim()).toBe('work');
    expect(errs.join('')).toMatch(/ok: set local workspace to 'work'/);
  });

  it('positional name with bad name: exit 2', async () => {
    expect(await runLocal(['has space'])).toBe(2);
  });

  it('positional name pointing at nonexistent workspace: exit 1', async () => {
    expect(await runLocal(['nope'])).toBe(1);
    expect(errs.join('')).toMatch(/workspace 'nope' does not exist/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/commands/local.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/commands/local.ts
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { wsDir } from '../paths.js';
import { validateName } from '../validate.js';
import { logError, logInfo, logOk, logWarn } from '../logger.js';

const MARKER = '.ccws-workspace';

export async function runLocal(argv: string[]): Promise<number> {
  const target = join(process.cwd(), MARKER);

  if (argv.length === 0) {
    if (!existsSync(target)) {
      logError(`no ${MARKER} in ${process.cwd()}`);
      return 1;
    }
    const text = readFileSync(target, 'utf8');
    const line = text.split('\n').find((l) => l.replace(/\s+/g, '') !== '');
    if (!line) { logError(`${target} is empty`); return 1; }
    process.stdout.write(`${line.replace(/\s+/g, '')}\n`);
    return 0;
  }

  const first = argv[0]!;
  if (first === '--unset' || first === '-u') {
    if (existsSync(target)) { unlinkSync(target); logOk(`removed ${MARKER} from ${process.cwd()}`); return 0; }
    logWarn(`no ${MARKER} in ${process.cwd()}`);
    return 0;
  }
  if (first.startsWith('-')) { logError(`unknown flag: ${first}`); return 2; }

  const v = validateName(first);
  if (!v.ok) { logError(v.reason); return 2; }
  if (!existsSync(wsDir(first))) {
    logError(`workspace '${first}' does not exist (use 'ccws add ${first}' first)`);
    return 1;
  }
  writeFileSync(target, `${first}\n`);
  logOk(`set local workspace to '${first}' in ${process.cwd()}`);
  return 0;
}
```

- [ ] **Step 4: Wire into `cli.ts`**

```typescript
import { runLocal } from './commands/local.js';
registerCommand('local', runLocal);
```

- [ ] **Step 5: Run tests**

```bash
bunx vitest run tests/commands/local.test.ts
```

Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add bun/src/commands/local.ts bun/src/cli.ts bun/tests/commands/local.test.ts
git commit -m "feat(bun): ccws local — read / set / --unset .ccws-workspace"
```

---

### Task 17: global command

**Files:**
- Create: `bun/src/commands/global.ts`
- Modify: `bun/src/cli.ts`
- Test: `bun/tests/commands/global.test.ts`

Reference: `lib/cmd_global.sh`. Same shape as `local` but writes to `~/.ccws/global` instead of `./.ccws-workspace`.

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/commands/global.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runGlobal } from '../../src/commands/global.js';

describe('runGlobal', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let outs: string[]; let errs: string[];
  let outSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-global-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    mkdirSync(join(tmp, '.ccws/workspaces/work'), { recursive: true });
    outs = []; errs = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { outs.push(String(c)); return true; });
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); errSpy.mockRestore(); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('no args + no file: error + exit 1', async () => {
    expect(await runGlobal([])).toBe(1);
    expect(errs.join('')).toMatch(/no global workspace set/);
  });

  it('positional name writes ~/.ccws/global', async () => {
    expect(await runGlobal(['work'])).toBe(0);
    expect(readFileSync(join(tmp, '.ccws/global'), 'utf8').trim()).toBe('work');
  });

  it('no args + file present: print name', async () => {
    writeFileSync(join(tmp, '.ccws/global'), 'work\n');
    expect(await runGlobal([])).toBe(0);
    expect(outs.join('')).toBe('work\n');
  });

  it('--unset removes file, idempotent', async () => {
    writeFileSync(join(tmp, '.ccws/global'), 'work\n');
    expect(await runGlobal(['--unset'])).toBe(0);
    expect(existsSync(join(tmp, '.ccws/global'))).toBe(false);
    outs.length = 0; errs.length = 0;
    expect(await runGlobal(['--unset'])).toBe(0);
    expect(errs.join('')).toMatch(/no global workspace set/);
  });

  it('positional pointing at missing workspace: exit 1', async () => {
    expect(await runGlobal(['nope'])).toBe(1);
  });

  it('bad name: exit 2', async () => {
    expect(await runGlobal(['has space'])).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/commands/global.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/commands/global.ts
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { globalScopeFile, wsDir } from '../paths.js';
import { validateName } from '../validate.js';
import { logError, logOk, logWarn } from '../logger.js';

export async function runGlobal(argv: string[]): Promise<number> {
  const target = globalScopeFile();

  if (argv.length === 0) {
    if (!existsSync(target)) { logError('no global workspace set'); return 1; }
    const text = readFileSync(target, 'utf8');
    const line = text.split('\n').find((l) => l.replace(/\s+/g, '') !== '');
    if (!line) { logError(`${target} is empty`); return 1; }
    process.stdout.write(`${line.replace(/\s+/g, '')}\n`);
    return 0;
  }

  const first = argv[0]!;
  if (first === '--unset' || first === '-u') {
    if (existsSync(target)) { unlinkSync(target); logOk('removed global workspace'); return 0; }
    logWarn('no global workspace set');
    return 0;
  }
  if (first.startsWith('-')) { logError(`unknown flag: ${first}`); return 2; }

  const v = validateName(first);
  if (!v.ok) { logError(v.reason); return 2; }
  if (!existsSync(wsDir(first))) {
    logError(`workspace '${first}' does not exist (use 'ccws add ${first}' first)`);
    return 1;
  }
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${first}\n`);
  logOk(`set global workspace to '${first}'`);
  return 0;
}
```

- [ ] **Step 4: Wire into `cli.ts`**

```typescript
import { runGlobal } from './commands/global.js';
registerCommand('global', runGlobal);
```

- [ ] **Step 5: Run tests**

```bash
bunx vitest run tests/commands/global.test.ts
```

Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add bun/src/commands/global.ts bun/src/cli.ts bun/tests/commands/global.test.ts
git commit -m "feat(bun): ccws global — read / set / --unset user-default workspace"
```

---

## Phase D — Mutating workspace commands (Tasks 18-22)

These commands write workspaces, delete them, refresh symlinks. They all use `withLock` (Task 7). One env-file helper is added in Task 18 (centralized atomic env writer matching the bash `ccws_env_write`).

### Task 18: env writer helper

**Files:**
- Modify: `bun/src/env.ts`
- Test: `bun/tests/env.test.ts` (extend existing)

Why this is its own task: `add` and `init` both need to write the `ccws.env` file from scratch with the right shape (header + CCWS_NAME + CCWS_CREATED + optional fields + chmod 600). Bash centralizes this in `ccws_env_write`; we mirror it.

- [ ] **Step 1: Write the failing test (append to existing env.test.ts)**

Append to the existing `bun/tests/env.test.ts` (do not create a new file — Phase 1 already has tests for parseEnvFile/setEnvKey/unsetEnvKey):

```typescript
import { writeEnvFile } from '../src/env.js';
import { mkdtempSync, rmSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('writeEnvFile', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'ccws-env-w-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  it('writes header + CCWS_NAME + CCWS_CREATED', () => {
    const p = join(dir, 'ccws.env');
    writeEnvFile(p, { name: 'work' });
    const text = readFileSync(p, 'utf8');
    expect(text).toMatch(/^# ccws workspace env file/m);
    expect(text).toMatch(/^# created by ccws — chmod 600/m);
    expect(text).toMatch(/^CCWS_NAME=work$/m);
    expect(text).toMatch(/^CCWS_CREATED=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m);
  });

  it('appends optional fields when provided', () => {
    const p = join(dir, 'ccws.env');
    writeEnvFile(p, {
      name: 'work',
      baseUrl: 'https://api.x',
      token: 'sk-123',
      binary: '/opt/claude',
      description: 'team',
      proxy: 'http://p:7890',
    });
    const text = readFileSync(p, 'utf8');
    expect(text).toMatch(/^ANTHROPIC_BASE_URL=https:\/\/api\.x$/m);
    expect(text).toMatch(/^ANTHROPIC_AUTH_TOKEN=sk-123$/m);
    expect(text).toMatch(/^CCWS_BINARY=\/opt\/claude$/m);
    expect(text).toMatch(/^CCWS_DESCRIPTION=team$/m);
    expect(text).toMatch(/^HTTPS_PROXY=http:\/\/p:7890$/m);
    expect(text).toMatch(/^HTTP_PROXY=http:\/\/p:7890$/m);
  });

  it('skips optional fields that are empty string', () => {
    const p = join(dir, 'ccws.env');
    writeEnvFile(p, { name: 'work', baseUrl: '', token: '', description: '' });
    const text = readFileSync(p, 'utf8');
    expect(text).not.toMatch(/ANTHROPIC_BASE_URL/);
    expect(text).not.toMatch(/ANTHROPIC_AUTH_TOKEN/);
    expect(text).not.toMatch(/CCWS_DESCRIPTION/);
  });

  it('chmods file to 600', () => {
    const p = join(dir, 'ccws.env');
    writeEnvFile(p, { name: 'work' });
    const mode = statSync(p).mode & 0o777;
    expect(mode).toBe(0o600);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/env.test.ts
```

Expected: existing tests pass, new ones FAIL (writeEnvFile not exported).

- [ ] **Step 3: Extend `bun/src/env.ts`**

Add at the bottom of the file (do not modify existing functions):

```typescript
import { chmodSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface WriteEnvOptions {
  name: string;
  baseUrl?: string;
  token?: string;
  binary?: string;
  description?: string;
  proxy?: string;
}

function isoNowUTC(): string {
  // 2026-05-20T12:34:56Z
  return new Date().toISOString().replace(/\.\d+Z$/, 'Z');
}

export function writeEnvFile(path: string, opts: WriteEnvOptions): void {
  mkdirSync(dirname(path), { recursive: true });
  const lines: string[] = [
    '# ccws workspace env file',
    '# created by ccws — chmod 600',
    `CCWS_NAME=${opts.name}`,
    `CCWS_CREATED=${isoNowUTC()}`,
  ];
  if (opts.baseUrl && opts.baseUrl !== '')         lines.push(`ANTHROPIC_BASE_URL=${opts.baseUrl}`);
  if (opts.token && opts.token !== '')             lines.push(`ANTHROPIC_AUTH_TOKEN=${opts.token}`);
  if (opts.binary && opts.binary !== '')           lines.push(`CCWS_BINARY=${opts.binary}`);
  if (opts.description && opts.description !== '') lines.push(`CCWS_DESCRIPTION=${opts.description}`);
  if (opts.proxy && opts.proxy !== '') {
    lines.push(`HTTPS_PROXY=${opts.proxy}`);
    lines.push(`HTTP_PROXY=${opts.proxy}`);
  }
  writeFileSync(path, `${lines.join('\n')}\n`);
  chmodSync(path, 0o600);
}
```

Note: `writeFileSync` is already imported at the top of env.ts; just add `chmodSync` and `mkdirSync` to that existing import block. Do not duplicate the import.

- [ ] **Step 4: Run tests**

```bash
bunx vitest run tests/env.test.ts
```

Expected: all passed (existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add bun/src/env.ts bun/tests/env.test.ts
git commit -m "feat(bun): writeEnvFile — atomic ccws.env creation with chmod 600"
```

---

### Task 19: rm command

**Files:**
- Create: `bun/src/commands/rm.ts`
- Modify: `bun/src/cli.ts`
- Test: `bun/tests/commands/rm.test.ts`

Reference: `lib/cmd_rm.sh`. Validates name → checks dir exists → refuses if active → confirms unless `-f` → `withLock` + recursive delete. Confirmation prompt goes to stderr, reads from stdin.

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/commands/rm.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runRm } from '../../src/commands/rm.js';
import { _setReader } from '../../src/prompt.js';

describe('runRm', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let errs: string[];
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-rm-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    mkdirSync(join(tmp, '.ccws/workspaces/work'), { recursive: true });
    delete process.env.CCWS_NAME;
    errs = [];
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { errSpy.mockRestore(); _setReader(null); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('exit 2 on bad name', async () => {
    expect(await runRm(['has space'])).toBe(2);
  });

  it('exit 1 when workspace missing', async () => {
    expect(await runRm(['nope', '-f'])).toBe(1);
  });

  it('exit 1 when workspace is currently active in shell', async () => {
    process.env.CCWS_NAME = 'work';
    expect(await runRm(['work', '-f'])).toBe(1);
    expect(errs.join('')).toMatch(/currently active/);
  });

  it('--force skips confirmation and deletes', async () => {
    expect(await runRm(['work', '-f'])).toBe(0);
    expect(existsSync(join(tmp, '.ccws/workspaces/work'))).toBe(false);
    expect(errs.join('')).toMatch(/ok: removed workspace 'work'/);
  });

  it('prompts y/N: empty input cancels', async () => {
    _setReader(async () => '\n');
    expect(await runRm(['work'])).toBe(1);
    expect(existsSync(join(tmp, '.ccws/workspaces/work'))).toBe(true);
    expect(errs.join('')).toMatch(/cancelled/);
  });

  it('prompts y/N: y confirms and deletes', async () => {
    _setReader(async () => 'y\n');
    expect(await runRm(['work'])).toBe(0);
    expect(existsSync(join(tmp, '.ccws/workspaces/work'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/commands/rm.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/commands/rm.ts
import { existsSync, rmSync } from 'node:fs';
import { wsDir } from '../paths.js';
import { validateName } from '../validate.js';
import { withLock } from '../lock.js';
import { logError, logInfo, logOk } from '../logger.js';
import { promptLine } from '../prompt.js';

export async function runRm(argv: string[]): Promise<number> {
  let name = '';
  let force = false;
  for (const a of argv) {
    if (a === '-f' || a === '--force') { force = true; continue; }
    if (a.startsWith('-')) { logError(`unknown flag: ${a}`); return 2; }
    if (name === '') name = a;
  }
  const v = validateName(name);
  if (!v.ok) { logError(v.reason); return 2; }

  const ws = wsDir(name);
  if (!existsSync(ws)) { logError(`workspace not found: ${name}`); return 1; }
  if ((process.env.CCWS_NAME ?? '') === name) {
    logError(`'${name}' is currently active in this shell; run 'ccws unset' first`);
    return 1;
  }
  if (!force) {
    const reply = await promptLine(`remove workspace "${name}" at ${ws}? [y/N] `);
    if (reply !== 'y' && reply !== 'Y') { logInfo('cancelled'); return 1; }
  }
  await withLock(10, async () => { rmSync(ws, { recursive: true, force: true }); });
  logOk(`removed workspace '${name}'`);
  return 0;
}
```

- [ ] **Step 4: Wire into `cli.ts`**

```typescript
import { runRm } from './commands/rm.js';
registerCommand('rm', runRm);
```

- [ ] **Step 5: Run tests**

```bash
bunx vitest run tests/commands/rm.test.ts
```

Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add bun/src/commands/rm.ts bun/src/cli.ts bun/tests/commands/rm.test.ts
git commit -m "feat(bun): ccws rm — confirmation + locked recursive delete"
```

---

### Task 20: sync command

**Files:**
- Create: `bun/src/commands/sync.ts`
- Modify: `bun/src/cli.ts`
- Test: `bun/tests/commands/sync.test.ts`

Reference: `lib/cmd_sync.sh`. With name: validate + sync that one. Without name: sync all. Idempotent.

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/commands/sync.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, lstatSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runSync } from '../../src/commands/sync.js';

describe('runSync', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let errs: string[];
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-sync-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    process.env.CCWS_REAL_CLAUDE_DIR = join(tmp, '.claude');
    mkdirSync(join(tmp, '.claude/commands'), { recursive: true });
    writeFileSync(join(tmp, '.claude/settings.json'), '{}');
    mkdirSync(join(tmp, '.ccws/workspaces/alpha'), { recursive: true });
    mkdirSync(join(tmp, '.ccws/workspaces/beta'), { recursive: true });
    errs = [];
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { errSpy.mockRestore(); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('exit 2 on bad name', async () => {
    expect(await runSync(['has space'])).toBe(2);
  });

  it('named workspace missing: exit 1', async () => {
    expect(await runSync(['nope'])).toBe(1);
  });

  it('named workspace: links it and exits 0', async () => {
    expect(await runSync(['alpha'])).toBe(0);
    expect(lstatSync(join(tmp, '.ccws/workspaces/alpha/settings.json')).isSymbolicLink()).toBe(true);
    expect(errs.join('')).toMatch(/ok: synced workspace 'alpha'/);
  });

  it('no name: syncs all and reports count', async () => {
    expect(await runSync([])).toBe(0);
    expect(lstatSync(join(tmp, '.ccws/workspaces/alpha/settings.json')).isSymbolicLink()).toBe(true);
    expect(lstatSync(join(tmp, '.ccws/workspaces/beta/settings.json')).isSymbolicLink()).toBe(true);
    expect(errs.join('')).toMatch(/ok: synced 2 workspace\(s\)/);
  });

  it('no workspaces yet: prints info, exit 0', async () => {
    rmSync(join(tmp, '.ccws/workspaces'), { recursive: true, force: true });
    expect(await runSync([])).toBe(0);
    expect(errs.join('')).toMatch(/no workspaces/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/commands/sync.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/commands/sync.ts
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { workspacesDir, wsDir } from '../paths.js';
import { validateName } from '../validate.js';
import { farmSync } from '../symlinkFarm.js';
import { logError, logInfo, logOk } from '../logger.js';

export async function runSync(argv: string[]): Promise<number> {
  const name = argv[0];

  if (name !== undefined) {
    const v = validateName(name);
    if (!v.ok) { logError(v.reason); return 2; }
    if (!existsSync(wsDir(name))) { logError(`workspace not found: ${name}`); return 1; }
    farmSync(name);
    logOk(`synced workspace '${name}'`);
    return 0;
  }

  const dir = workspacesDir();
  if (!existsSync(dir)) { logInfo('no workspaces'); return 0; }
  let count = 0;
  for (const n of readdirSync(dir)) {
    try { if (!statSync(join(dir, n)).isDirectory()) continue; } catch { continue; }
    farmSync(n);
    count += 1;
  }
  logOk(`synced ${count} workspace(s)`);
  return 0;
}
```

- [ ] **Step 4: Wire into `cli.ts`**

```typescript
import { runSync } from './commands/sync.js';
registerCommand('sync', runSync);
```

- [ ] **Step 5: Run tests**

```bash
bunx vitest run tests/commands/sync.test.ts
```

Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add bun/src/commands/sync.ts bun/src/cli.ts bun/tests/commands/sync.test.ts
git commit -m "feat(bun): ccws sync — refresh symlinks for one or all workspaces"
```

---

### Task 21: add command

**Files:**
- Create: `bun/src/commands/add.ts`
- Modify: `bun/src/cli.ts`
- Test: `bun/tests/commands/add.test.ts`

Reference: `lib/cmd_add.sh`. The most complex command. Flags + optional interactive prompts for fields not given via flags (skipped under `--non-interactive`). Soft-warns if `~/.claude/` is missing. Uses `withLock` + writes `ccws.env` + creates symlink farm.

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/commands/add.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runAdd } from '../../src/commands/add.js';
import { _setReader } from '../../src/prompt.js';

describe('runAdd', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let errs: string[];
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-add-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    process.env.CCWS_REAL_CLAUDE_DIR = join(tmp, '.claude');
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    writeFileSync(join(tmp, '.claude/settings.json'), '{}');
    errs = [];
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { errSpy.mockRestore(); _setReader(null); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('exit 2 on bad name', async () => {
    expect(await runAdd(['has space', '--non-interactive'])).toBe(2);
  });

  it('exit 1 if workspace already exists', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/work'), { recursive: true });
    expect(await runAdd(['work', '--non-interactive'])).toBe(1);
    expect(errs.join('')).toMatch(/already exists/);
  });

  it('non-interactive flow: writes ccws.env with provided flags only', async () => {
    expect(await runAdd(['work', '--base-url', 'https://api.x', '--token', 'sk-1', '--non-interactive'])).toBe(0);
    const env = readFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'), 'utf8');
    expect(env).toMatch(/^CCWS_NAME=work$/m);
    expect(env).toMatch(/^ANTHROPIC_BASE_URL=https:\/\/api\.x$/m);
    expect(env).toMatch(/^ANTHROPIC_AUTH_TOKEN=sk-1$/m);
    expect(env).not.toMatch(/CCWS_DESCRIPTION/);
    expect(env).not.toMatch(/HTTPS_PROXY/);
  });

  it('creates symlink farm', async () => {
    expect(await runAdd(['work', '--non-interactive'])).toBe(0);
    expect(lstatSync(join(tmp, '.ccws/workspaces/work/settings.json')).isSymbolicLink()).toBe(true);
  });

  it('proxy flag writes both HTTPS_PROXY and HTTP_PROXY', async () => {
    expect(await runAdd(['work', '--proxy', 'http://p:7890', '--non-interactive'])).toBe(0);
    const env = readFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'), 'utf8');
    expect(env).toMatch(/^HTTPS_PROXY=http:\/\/p:7890$/m);
    expect(env).toMatch(/^HTTP_PROXY=http:\/\/p:7890$/m);
  });

  it('interactive flow: prompts for name when none given', async () => {
    // 5 prompts: name → url → token → description → proxy y/n
    const replies = ['work\n', '\n', '\n', '\n', 'n\n'];
    let idx = 0;
    _setReader(async () => replies[idx++] ?? null);
    expect(await runAdd([])).toBe(0);
    expect(existsSync(join(tmp, '.ccws/workspaces/work/ccws.env'))).toBe(true);
  });

  it('interactive proxy y: prompts again for URL', async () => {
    // name → url(blank) → token(blank) → desc(blank) → proxy=y → proxyUrl(blank → default)
    const replies = ['p\n', '\n', '\n', '\n', 'y\n', '\n'];
    let idx = 0;
    _setReader(async () => replies[idx++] ?? null);
    expect(await runAdd([])).toBe(0);
    const env = readFileSync(join(tmp, '.ccws/workspaces/p/ccws.env'), 'utf8');
    expect(env).toMatch(/HTTPS_PROXY=http:\/\/127\.0\.0\.1:7890/);
  });

  it('soft-warns when ~/.claude is missing', async () => {
    rmSync(join(tmp, '.claude'), { recursive: true, force: true });
    expect(await runAdd(['work', '--non-interactive'])).toBe(0);
    expect(errs.join('')).toMatch(/warn:.*\.claude\/ does not exist/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/commands/add.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/commands/add.ts
import { existsSync, mkdirSync } from 'node:fs';
import { envFile, realClaudeDir, wsDir } from '../paths.js';
import { validateName } from '../validate.js';
import { writeEnvFile } from '../env.js';
import { farmCreate } from '../symlinkFarm.js';
import { withLock } from '../lock.js';
import { logError, logOk, logWarn } from '../logger.js';
import { promptHidden, promptLine, promptYn } from '../prompt.js';

interface ParsedArgs {
  name: string;
  baseUrl: string;     hasBaseUrl: boolean;
  token: string;       hasToken: boolean;
  binary: string;      // not prompted
  description: string; hasDescription: boolean;
  proxy: string;       hasProxy: boolean;
  nonInteractive: boolean;
}

function parseArgs(argv: string[]): ParsedArgs | { error: string } {
  const out: ParsedArgs = {
    name: '',
    baseUrl: '', hasBaseUrl: false,
    token: '',   hasToken: false,
    binary: '',
    description: '', hasDescription: false,
    proxy: '',   hasProxy: false,
    nonInteractive: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--base-url')        { out.baseUrl    = argv[++i] ?? ''; out.hasBaseUrl    = true; continue; }
    if (a === '--token')           { out.token      = argv[++i] ?? ''; out.hasToken      = true; continue; }
    if (a === '--binary')          { out.binary     = argv[++i] ?? '';                          continue; }
    if (a === '--description')     { out.description= argv[++i] ?? ''; out.hasDescription= true; continue; }
    if (a === '--proxy')           { out.proxy      = argv[++i] ?? ''; out.hasProxy      = true; continue; }
    if (a === '--non-interactive') { out.nonInteractive = true; continue; }
    if (a.startsWith('-'))         { return { error: `unknown flag: ${a}` }; }
    if (out.name !== '')           { return { error: `extra positional arg: ${a}` }; }
    out.name = a;
  }
  return out;
}

export async function runAdd(argv: string[]): Promise<number> {
  const parsed = parseArgs(argv);
  if ('error' in parsed) { logError(parsed.error); return 2; }

  // Prompt for name if missing and interactive
  if (parsed.name === '' && !parsed.nonInteractive) {
    parsed.name = await promptLine('Workspace name: ');
    if (parsed.name === '') { logError('name required'); return 2; }
  }

  // Prompt for optional fields
  if (!parsed.nonInteractive) {
    if (!parsed.hasBaseUrl) {
      const v = await promptLine('Endpoint URL (Anthropic default, blank to skip): ');
      if (v !== '') { parsed.baseUrl = v; parsed.hasBaseUrl = true; }
    }
    if (!parsed.hasToken) {
      const v = await promptHidden('API token (paste, hidden; blank to skip): ');
      if (v !== '') { parsed.token = v; parsed.hasToken = true; }
    }
    if (!parsed.hasDescription) {
      const v = await promptLine('Description (optional): ');
      if (v !== '') { parsed.description = v; parsed.hasDescription = true; }
    }
    if (!parsed.hasProxy) {
      const yes = await promptYn('Enable proxy?', 'N');
      if (yes) {
        const url = await promptLine('Proxy URL [http://127.0.0.1:7890]: ');
        parsed.proxy = url === '' ? 'http://127.0.0.1:7890' : url;
        parsed.hasProxy = true;
      }
    }
  }

  const v = validateName(parsed.name);
  if (!v.ok) { logError(v.reason); return 2; }
  const ws = wsDir(parsed.name);
  if (existsSync(ws)) { logError(`workspace '${parsed.name}' already exists at ${ws}`); return 1; }

  if (!existsSync(realClaudeDir())) {
    logWarn(`~/.claude/ does not exist — symlinks will be empty until you run 'claude' once, then 'ccws doctor'`);
  }

  await withLock(10, async () => {
    mkdirSync(ws, { recursive: true });
    writeEnvFile(envFile(parsed.name), {
      name: parsed.name,
      baseUrl: parsed.hasBaseUrl ? parsed.baseUrl : undefined,
      token: parsed.hasToken ? parsed.token : undefined,
      binary: parsed.binary !== '' ? parsed.binary : undefined,
      description: parsed.hasDescription ? parsed.description : undefined,
      proxy: parsed.hasProxy ? parsed.proxy : undefined,
    });
    farmCreate(parsed.name);
  });

  logOk(`created workspace '${parsed.name}' at ${ws}`);
  return 0;
}
```

- [ ] **Step 4: Wire into `cli.ts`**

```typescript
import { runAdd } from './commands/add.js';
registerCommand('add', runAdd);
```

- [ ] **Step 5: Run tests**

```bash
bunx vitest run tests/commands/add.test.ts
```

Expected: 8 passed.

- [ ] **Step 6: Commit**

```bash
git add bun/src/commands/add.ts bun/src/cli.ts bun/tests/commands/add.test.ts
git commit -m "feat(bun): ccws add — interactive + flag-driven workspace creation"
```

---

### Task 22: doctor command

**Files:**
- Create: `bun/src/commands/doctor.ts`
- Modify: `bun/src/cli.ts`
- Test: `bun/tests/commands/doctor.test.ts`

Reference: `lib/cmd_doctor.sh`. 7 checks with colored marks (`✓` green, `!` yellow, `✗` red). Summary line. Exits 0 if zero errors (warnings allowed), 1 if any error.

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/commands/doctor.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runDoctor } from '../../src/commands/doctor.js';

function stripAnsi(s: string): string { return s.replace(/\x1b\[[0-9;]*m/g, ''); }

describe('runDoctor', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let outs: string[];
  let outSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-doctor-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    process.env.CCWS_REAL_CLAUDE_DIR = join(tmp, '.claude');
    process.env.PATH = '/usr/bin:/bin';
    delete process.env.CLAUDE_CONFIG_DIR;
    delete process.env.CCWS_NAME;
    outs = [];
    outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { outs.push(String(c)); return true; });
  });
  afterEach(() => { outSpy.mockRestore(); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  function out(): string { return stripAnsi(outs.join('')); }

  it('summary line always present, exit 0 with zero errors', async () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    mkdirSync(join(tmp, '.ccws/workspaces/alpha'), { recursive: true });
    writeFileSync(join(tmp, '.ccws/workspaces/alpha/ccws.env'), 'CCWS_NAME=alpha\n');
    // Provide a fake claude binary
    mkdirSync(join(tmp, 'bin'), { recursive: true });
    writeFileSync(join(tmp, 'bin/claude'), '#!/bin/sh\n');
    process.env.PATH = `${join(tmp, 'bin')}:${process.env.PATH}`;
    const code = await runDoctor([]);
    expect(out()).toMatch(/summary: \d+ warning\(s\), \d+ error\(s\)/);
    expect(code).toBe(0);
  });

  it('warns when ~/.claude is missing', async () => {
    mkdirSync(join(tmp, '.ccws'), { recursive: true });
    await runDoctor([]);
    expect(out()).toMatch(/! ~\/\.claude\/ missing/);
  });

  it('errors when ccws.env is missing for a workspace', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/x'), { recursive: true });
    const code = await runDoctor([]);
    expect(out()).toMatch(/✗ workspace 'x' missing ccws\.env/);
    expect(code).toBe(1);
  });

  it('warns on broken symlinks in a workspace', async () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    mkdirSync(join(tmp, '.ccws/workspaces/alpha'), { recursive: true });
    writeFileSync(join(tmp, '.ccws/workspaces/alpha/ccws.env'), 'CCWS_NAME=alpha\n');
    symlinkSync(join(tmp, '.claude/missing.json'), join(tmp, '.ccws/workspaces/alpha/settings.json'));
    await runDoctor([]);
    expect(out()).toMatch(/! workspace 'alpha' has broken symlinks/);
  });

  it('warns when CLAUDE_CONFIG_DIR is set outside ccws', async () => {
    process.env.CLAUDE_CONFIG_DIR = '/tmp/elsewhere';
    delete process.env.CCWS_NAME;
    await runDoctor([]);
    expect(out()).toMatch(/! CLAUDE_CONFIG_DIR set outside ccws/);
  });

  it('errors when claude binary is missing from PATH', async () => {
    process.env.PATH = '/no/such/path';
    const code = await runDoctor([]);
    expect(out()).toMatch(/✗ claude binary not on PATH/);
    expect(code).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/commands/doctor.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/commands/doctor.ts
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ccwsRoot, envFile, realClaudeDir, workspacesDir } from '../paths.js';
import { parseEnvFile } from '../env.js';
import { farmVerify } from '../symlinkFarm.js';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';

type Status = 'ok' | 'warn' | 'error';

function writeCheck(label: string, status: Status, detail: string): { warn: number; err: number } {
  let line = '';
  if (status === 'ok')    line = `  ${GREEN}✓${RESET} ${label}\n`;
  if (status === 'warn')  line = `  ${YELLOW}!${RESET} ${label} — ${detail}\n`;
  if (status === 'error') line = `  ${RED}✗${RESET} ${label} — ${detail}\n`;
  process.stdout.write(line);
  return { warn: status === 'warn' ? 1 : 0, err: status === 'error' ? 1 : 0 };
}

function claudeOnPath(): boolean {
  const pathEnv = process.env.PATH ?? '';
  for (const p of pathEnv.split(':')) {
    if (p === '') continue;
    const candidate = join(p, 'claude');
    try {
      const st = statSync(candidate);
      if (st.isFile() || st.isSymbolicLink()) return true;
    } catch { /* not found, keep looking */ }
  }
  return false;
}

export async function runDoctor(_argv: string[]): Promise<number> {
  let warns = 0; let errs = 0;
  const tally = (r: { warn: number; err: number }) => { warns += r.warn; errs += r.err; };

  process.stdout.write('ccws doctor — environment health checks\n\n');

  // 1. ~/.claude exists
  if (existsSync(realClaudeDir())) {
    tally(writeCheck('~/.claude/ exists', 'ok', ''));
  } else {
    tally(writeCheck("~/.claude/ missing — run 'claude' once to initialize, then 'ccws sync'", 'warn', '~/.claude/ not found'));
  }

  // 2. ~/.ccws exists
  if (existsSync(ccwsRoot())) {
    tally(writeCheck('~/.ccws/ initialized', 'ok', ''));
  } else {
    tally(writeCheck('~/.ccws/ missing', 'warn', "run 'ccws add <name>' to create first workspace"));
  }

  // 3 + 4. Symlink integrity + ccws.env validity per workspace
  const wsDir = workspacesDir();
  if (existsSync(wsDir)) {
    for (const n of readdirSync(wsDir)) {
      try { if (!statSync(join(wsDir, n)).isDirectory()) continue; } catch { continue; }
      const r = farmVerify(n);
      if (r.ok) tally(writeCheck(`workspace '${n}' symlinks ok`, 'ok', ''));
      else      tally(writeCheck(`workspace '${n}' has broken symlinks`, 'warn', `run 'ccws sync ${n}'`));
    }
    for (const n of readdirSync(wsDir)) {
      try { if (!statSync(join(wsDir, n)).isDirectory()) continue; } catch { continue; }
      const f = envFile(n);
      if (!existsSync(f)) {
        tally(writeCheck(`workspace '${n}' missing ccws.env`, 'error', "re-run 'ccws add' or hand-create"));
        continue;
      }
      const env = parseEnvFile(f);
      if (env.CCWS_NAME === n) tally(writeCheck(`workspace '${n}' env valid`, 'ok', ''));
      else tally(writeCheck(`workspace '${n}' env has wrong CCWS_NAME`, 'warn', `found '${env.CCWS_NAME ?? ''}'`));
    }
  }

  // 5. CLAUDE_CONFIG_DIR set outside ccws
  if ((process.env.CLAUDE_CONFIG_DIR ?? '') !== '' && (process.env.CCWS_NAME ?? '') === '') {
    tally(writeCheck('CLAUDE_CONFIG_DIR set outside ccws', 'warn', `${process.env.CLAUDE_CONFIG_DIR} — may conflict`));
  }

  // 6. claude binary on PATH
  if (claudeOnPath()) tally(writeCheck('claude binary on PATH', 'ok', ''));
  else                tally(writeCheck('claude binary not on PATH', 'error', 'install Claude Code first'));

  // 7. Shell rc has ccws init
  let foundInit = false;
  for (const rc of [join(process.env.HOME ?? '', '.bashrc'), join(process.env.HOME ?? '', '.zshrc'), join(process.env.HOME ?? '', '.config/fish/config.fish')]) {
    if (!existsSync(rc)) continue;
    try {
      if (readFileSync(rc, 'utf8').includes('ccws')) { foundInit = true; break; }
    } catch { /* unreadable rc */ }
  }
  if (foundInit) tally(writeCheck('shell rc has ccws init', 'ok', ''));
  else           tally(writeCheck('shell rc missing ccws init', 'warn', 'run install.sh to wire it up'));

  process.stdout.write(`\nsummary: ${warns} warning(s), ${errs} error(s)\n`);
  return errs === 0 ? 0 : 1;
}
```

- [ ] **Step 4: Wire into `cli.ts`**

```typescript
import { runDoctor } from './commands/doctor.js';
registerCommand('doctor', runDoctor);
```

- [ ] **Step 5: Run tests**

```bash
bunx vitest run tests/commands/doctor.test.ts
```

Expected: 6 passed.

- [ ] **Step 6: Commit**

```bash
git add bun/src/commands/doctor.ts bun/src/cli.ts bun/tests/commands/doctor.test.ts
git commit -m "feat(bun): ccws doctor — 7 health checks with colored marks"
```

---

## Phase E — Init wizard (Tasks 23-24)

The init wizard is interactive, multi-step, and has a `--reset` branch. It depends on `runAdd` for the optional first-workspace step. Split into two tasks: the wizard logic + the slash-command copy.

### Task 23: init wizard

**Files:**
- Create: `bun/src/commands/init.ts`
- Modify: `bun/src/cli.ts`
- Test: `bun/tests/commands/init.test.ts`

Reference: `lib/cmd_init.sh`. Three steps: detect/bootstrap `~/.claude`, install slash commands, optionally add first workspace. `--reset` deletes `~/.ccws` first. Idempotent: if workspaces dir non-empty, print status and exit 0.

- [ ] **Step 1: Write the failing test**

```typescript
// bun/tests/commands/init.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runInit } from '../../src/commands/init.js';
import { _setReader } from '../../src/prompt.js';

describe('runInit', () => {
  let tmp: string;
  const origEnv = { ...process.env };
  let errs: string[];
  let errSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-init-'));
    process.env = { ...origEnv };
    process.env.HOME = tmp;
    process.env.CCWS_ROOT = join(tmp, '.ccws');
    process.env.CCWS_REAL_CLAUDE_DIR = join(tmp, '.claude');
    // Provide a CCWS_DIR so the slash-command copy step finds share/commands.
    process.env.CCWS_DIR = join(tmp, 'src');
    mkdirSync(join(tmp, 'src/share/commands'), { recursive: true });
    writeFileSync(join(tmp, 'src/share/commands/whoami.md'), '# whoami');
    writeFileSync(join(tmp, 'src/share/commands/switch.md'), '# switch');
    errs = [];
    errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { errs.push(String(c)); return true; });
  });
  afterEach(() => { errSpy.mockRestore(); _setReader(null); rmSync(tmp, { recursive: true, force: true }); process.env = origEnv; });

  it('exit 2 on unknown flag', async () => {
    expect(await runInit(['--what'])).toBe(2);
  });

  it('--help returns 0', async () => {
    expect(await runInit(['--help'])).toBe(0);
  });

  it('idempotent: if workspaces dir is non-empty, print status and exit 0', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/existing'), { recursive: true });
    expect(await runInit([])).toBe(0);
    expect(errs.join('')).toMatch(/already initialized/);
  });

  it('happy path with existing ~/.claude and skipped first workspace', async () => {
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    // skip the first-workspace prompt by sending blank name
    _setReader(async () => '\n');
    expect(await runInit([])).toBe(0);
    expect(existsSync(join(tmp, '.ccws/workspaces'))).toBe(true);
    // Slash commands copied
    expect(existsSync(join(tmp, '.claude/commands/whoami.md'))).toBe(true);
    expect(existsSync(join(tmp, '.claude/commands/switch.md'))).toBe(true);
  });

  it('cancels when user declines to bootstrap missing ~/.claude', async () => {
    _setReader(async () => 'n\n');
    expect(await runInit([])).toBe(0);
    expect(errs.join('')).toMatch(/cancelled\. Run 'claude' once/);
    expect(existsSync(join(tmp, '.claude'))).toBe(false);
  });

  it('bootstraps ~/.claude when user says yes', async () => {
    const replies = ['y\n', '\n']; // yes to bootstrap → skip first workspace
    let i = 0;
    _setReader(async () => replies[i++] ?? null);
    expect(await runInit([])).toBe(0);
    expect(existsSync(join(tmp, '.claude/commands'))).toBe(true);
    expect(existsSync(join(tmp, '.claude/plugins'))).toBe(true);
    expect(readFileSync(join(tmp, '.claude/settings.json'), 'utf8')).toBe('{}');
  });

  it('--reset cancels when user answers no', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/x'), { recursive: true });
    _setReader(async () => 'n\n');
    expect(await runInit(['--reset'])).toBe(1);
    expect(existsSync(join(tmp, '.ccws'))).toBe(true);
  });

  it('--reset wipes ~/.ccws when user confirms', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/x'), { recursive: true });
    mkdirSync(join(tmp, '.claude'), { recursive: true });
    const replies = ['y\n', '\n']; // confirm reset → skip first-workspace
    let i = 0;
    _setReader(async () => replies[i++] ?? null);
    expect(await runInit(['--reset'])).toBe(0);
    // After reset + re-init, workspaces dir exists but is empty
    expect(existsSync(join(tmp, '.ccws/workspaces/x'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bunx vitest run tests/commands/init.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Write the module**

```typescript
// bun/src/commands/init.ts
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ccwsRoot, realClaudeDir, workspacesDir } from '../paths.js';
import { logError, logInfo, logOk, logWarn } from '../logger.js';
import { promptLine, promptHidden, promptYn } from '../prompt.js';
import { runAdd } from './add.js';

const BANNER = `
╔══════════════════════════════════════════════╗
║  ccws · first-time setup                     ║
╚══════════════════════════════════════════════╝

`;

const HELP = `ccws init — interactive first-time setup

Usage: ccws init [--reset]

  --reset   Remove ~/.ccws/ and start fresh (asks confirmation)
`;

function findShareCommandsDir(): string | null {
  // 1) explicit CCWS_DIR override (set by repo-mode `bun run`)
  if (process.env.CCWS_DIR && process.env.CCWS_DIR !== '') {
    const p = join(process.env.CCWS_DIR, 'share/commands');
    if (existsSync(p)) return p;
  }
  // 2) installed binary: walk up from execPath looking for share/commands
  let d = dirname(process.execPath);
  for (let i = 0; i < 5; i++) {
    const candidate = join(d, 'share/commands');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return null;
}

export async function runInit(argv: string[]): Promise<number> {
  let reset = false;
  for (const a of argv) {
    if (a === '--reset') { reset = true; continue; }
    if (a === '--help' || a === '-h') { process.stderr.write(HELP); return 0; }
    logError(`unknown flag: ${a}`);
    return 2;
  }

  const root = ccwsRoot();

  if (reset && existsSync(root)) {
    process.stderr.write(`!! reset will delete ${root} and all workspaces. continue? [y/N] `);
    const r = await promptLine('');
    if (r !== 'y' && r !== 'Y') { logInfo('cancelled'); return 1; }
    rmSync(root, { recursive: true, force: true });
    logOk(`removed ${root}`);
  }

  // Idempotent re-init guard
  if (existsSync(workspacesDir())) {
    let entries: string[] = [];
    try { entries = readdirSync(workspacesDir()); } catch { entries = []; }
    if (entries.length > 0) {
      process.stderr.write('ccws init — already initialized.\n\nCurrent state:\n');
      const wsCount = entries.filter((n) => {
        try { return statSync(join(workspacesDir(), n)).isDirectory(); } catch { return false; }
      }).length;
      process.stderr.write(`  - ${wsCount} workspace(s)\n\nYou might want one of:\n`);
      process.stderr.write('  ccws add <name>     Add a new workspace\n');
      process.stderr.write('  ccws doctor         Health check\n');
      process.stderr.write('  ccws init --reset   Remove everything and start fresh\n');
      return 0;
    }
  }

  process.stderr.write(BANNER);

  // Bootstrap ~/.ccws/workspaces/
  mkdirSync(workspacesDir(), { recursive: true });

  // Step 1: ~/.claude/ detection
  process.stderr.write('[1/3] Checking ~/.claude/...\n\n');
  const claude = realClaudeDir();
  if (existsSync(claude)) {
    let plugins = 0; let skills = 0;
    try { if (existsSync(join(claude, 'plugins'))) plugins = readdirSync(join(claude, 'plugins')).length; } catch {}
    try { if (existsSync(join(claude, 'skills'))) skills = readdirSync(join(claude, 'skills')).length; } catch {}
    process.stderr.write(`  ✓ Found existing Claude Code install at ${claude}\n`);
    process.stderr.write(`    plugins: ${plugins} · skills: ${skills}\n\n`);
    process.stderr.write(`    Your existing setup stays as-is. Plain 'claude' keeps using it\n`);
    process.stderr.write(`    with your current account.\n`);
    process.stderr.write(`    ccws is for ADDITIONAL workspaces (other accounts / gateways).\n`);
    process.stderr.write(`    All workspaces share plugins/skills from ~/.claude/.\n`);
  } else {
    process.stderr.write('  ! No ~/.claude/ found.\n\n');
    process.stderr.write('  ccws needs ~/.claude/ as the shared plugin store. Two options:\n');
    process.stderr.write("    [a] Cancel — run 'claude' once first to bootstrap, then re-run 'ccws init'\n");
    process.stderr.write('    [b] Bootstrap empty ~/.claude/ now\n\n');
    const yes = await promptYn('  Bootstrap empty ~/.claude/?', 'N');
    if (!yes) { logInfo("cancelled. Run 'claude' once, then re-run 'ccws init'."); return 0; }
    for (const sub of ['commands', 'plugins', 'skills', 'hooks']) {
      mkdirSync(join(claude, sub), { recursive: true });
    }
    writeFileSync(join(claude, 'settings.json'), '{}');
    logOk(`created empty ${claude}/`);
  }

  // Step 2: slash commands
  process.stderr.write('\n[2/3] Installing slash commands...\n');
  const cmds = findShareCommandsDir();
  if (cmds && existsSync(cmds)) {
    mkdirSync(join(claude, 'commands'), { recursive: true });
    for (const f of readdirSync(cmds)) {
      if (!f.endsWith('.md')) continue;
      const dst = join(claude, 'commands', f);
      if (!existsSync(dst)) copyFileSync(join(cmds, f), dst);
    }
    logOk(`installed slash commands to ${claude}/commands/`);
  } else {
    logWarn('could not install slash commands (share/commands not found)');
  }

  // Step 3: first workspace
  process.stderr.write('\n[3/3] Add your first workspace?\n');
  process.stderr.write('      (for a different account or endpoint — leave blank to skip)\n\n');
  const firstName = await promptLine('  Workspace name (blank to skip): ');
  if (firstName !== '') {
    const firstUrl = await promptLine('  Endpoint URL (Anthropic default, blank to use it): ');
    const firstToken = await promptHidden('  API token (paste, hidden; blank to skip — login later): ');
    const args = [firstName, '--non-interactive'];
    if (firstUrl !== '') args.push('--base-url', firstUrl);
    if (firstToken !== '') args.push('--token', firstToken);
    const code = await runAdd(args);
    if (code === 0) logOk(`created workspace '${firstName}'`);
    else logError(`failed to create '${firstName}'`);
  } else {
    process.stderr.write('  (skipped)\n');
  }

  process.stderr.write('\nSetup complete.\n\nNext steps:\n');
  process.stderr.write('  ccws                  Open TUI picker\n');
  process.stderr.write('  ccws use <name>       Activate in this shell\n');
  process.stderr.write('  ccws add <name>       Add another workspace\n');
  process.stderr.write('  ccws doctor           Health check\n');
  process.stderr.write('  ccws --help           All commands\n\n');
  return 0;
}
```

- [ ] **Step 4: Wire into `cli.ts`**

```typescript
import { runInit } from './commands/init.js';
registerCommand('init', runInit);
```

- [ ] **Step 5: Run tests**

```bash
bunx vitest run tests/commands/init.test.ts
```

Expected: 8 passed.

- [ ] **Step 6: Commit**

```bash
git add bun/src/commands/init.ts bun/src/cli.ts bun/tests/commands/init.test.ts
git commit -m "feat(bun): ccws init — first-time wizard with bootstrap + first workspace"
```

---

### Task 24: dispatcher full coverage test

**Files:**
- Modify: `bun/tests/cli.test.ts` (extend existing)

After all commands are registered, add one final dispatch test that asserts every documented subcommand is registered. This catches "forgot to wire it up" regressions in a single check.

- [ ] **Step 1: Add the test (append to `bun/tests/cli.test.ts`)**

```typescript
describe('cli registration completeness', () => {
  it('every documented subcommand is registered', async () => {
    // Side-effect: importing cli registers all known commands.
    const { dispatch } = await import('../src/cli.js');
    // Each "unknown command: X" => not registered. Exit code 2 means "unknown",
    // any other exit code (success/validation) means "found a handler".
    const subcommands = ['add', 'init', 'list', 'current', 'use', 'unset', 'local', 'global', 'which', 'hook', 'rm', 'sync', 'doctor'];
    const stderrWrites: string[] = [];
    const stdoutWrites: string[] = [];
    const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation((c: unknown) => { stderrWrites.push(String(c)); return true; });
    const outSpy = vi.spyOn(process.stdout, 'write').mockImplementation((c: unknown) => { stdoutWrites.push(String(c)); return true; });
    try {
      for (const c of subcommands) {
        stderrWrites.length = 0; stdoutWrites.length = 0;
        await dispatch([c, '--help']).catch(() => {});
        // Either the handler ran (any code) or, for handlers without --help support,
        // we at minimum should NOT see "unknown command".
        expect(stderrWrites.join('')).not.toMatch(new RegExp(`unknown command: ${c}`));
      }
    } finally {
      errSpy.mockRestore();
      outSpy.mockRestore();
    }
  });
});
```

- [ ] **Step 2: Run the suite**

```bash
bunx vitest run tests/cli.test.ts
```

Expected: all passed.

- [ ] **Step 3: Commit**

```bash
git add bun/tests/cli.test.ts
git commit -m "test(bun): assert every documented subcommand is registered with cli"
```

---

## Phase F — Picker re-entry + binary CLI integration test (Tasks 25-27)

The picker still lives in `index.ts`. Move it into `commands/picker.ts` for symmetry, then add a black-box integration test that spawns the compiled binary and asserts on each subcommand's behavior. This is the smoke test that catches build issues before we touch `install.sh` (Task 36).

### Task 25: picker as a command module

**Files:**
- Create: `bun/src/commands/picker.ts`
- Modify: `bun/src/index.ts`

- [ ] **Step 1: Move the picker code**

```typescript
// bun/src/commands/picker.ts
import React from 'react';
import { render } from 'ink';
import { App } from '../picker/App.js';
import { scanWorkspaces, defaultWorkspacesDir } from '../workspace.js';
import type { LogoGateInputs } from '../logoData.js';

function gateInputs(): LogoGateInputs {
  return {
    envNoLogo: process.env.CCWS_NO_LOGO,
    stderrIsTTY: Boolean(process.stderr.isTTY),
    cols: process.stdout.columns ?? 80,
    lines: process.stdout.rows ?? 24,
  };
}

export async function runPicker(): Promise<number> {
  const workspacesDir = defaultWorkspacesDir();
  const initial = scanWorkspaces({ workspacesDir, activeName: process.env.CCWS_NAME ?? null });
  if (initial.length === 0) {
    process.stderr.write("ccws: warn: no workspaces — run 'ccws add <name>'\n");
    return 1;
  }
  return new Promise<number>((resolve) => {
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
          resolve(exitCode);
        },
      }),
      { stdout: process.stderr, exitOnCtrlC: false },
    );
    inkInstance.waitUntilExit().catch(() => resolve(1));
  });
}
```

- [ ] **Step 2: Slim `bun/src/index.ts` to dispatch + picker glue**

```typescript
// bun/src/index.ts
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
```

- [ ] **Step 3: Sanity check**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run src/index.ts --version
bun run src/index.ts list
bunx vitest run
```

Expected: version prints, `list` works, all vitest passes.

- [ ] **Step 4: Commit**

```bash
git add bun/src/commands/picker.ts bun/src/index.ts
git commit -m "refactor(bun): move picker into commands/picker.ts, slim index.ts to dispatch"
```

---

### Task 26: binary build + integration test harness

**Files:**
- Create: `bun/tests/integration/binary.test.ts`
- Modify: `bun/build.ts` — no functional change; only verify it still builds locally

The integration test spawns the **compiled** binary (not `bun run`) so we catch issues like missing externals (the `react-devtools-core` bug from Phase 1) before they reach users.

- [ ] **Step 1: Build a fresh local binary for the host platform**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun build --compile --target=bun --minify src/index.ts --outfile dist/ccws-host
chmod +x dist/ccws-host
./dist/ccws-host --version
```

Expected: `ccws 0.7.0`.

- [ ] **Step 2: Write the integration test**

```typescript
// bun/tests/integration/binary.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BIN = join(import.meta.dir, '../../dist/ccws-host');

async function run(args: string[], env: Record<string, string>): Promise<{ stdout: string; stderr: string; code: number }> {
  const p = Bun.spawn({ cmd: [BIN, ...args], stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env.PATH ?? '', ...env } });
  const [stdout, stderr] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  const code = await p.exited;
  return { stdout, stderr, code };
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
    // CCWS_DIR points at a fake repo with share/init.sh
    mkdirSync(join(tmp, 'src/share'), { recursive: true });
    writeFileSync(join(tmp, 'src/share/init.sh'), '');
    const r = await run(['hook', '--shell', 'zsh'], { HOME: tmp, CCWS_DIR: join(tmp, 'src') });
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toBe(`source '${join(tmp, 'src/share/init.sh')}'`);
  });
});
```

- [ ] **Step 3: Run the integration test**

```bash
bunx vitest run tests/integration/binary.test.ts
```

Expected: 7 passed. If the binary isn't built yet, the test gives a clear error message telling you the build command.

- [ ] **Step 4: Commit**

```bash
git add bun/tests/integration/binary.test.ts
git commit -m "test(bun): integration tests against compiled binary"
```

---

### Task 27: scripts polish

**Files:**
- Modify: `bun/package.json`

Add convenience scripts so future contributors can run the full suite in one shot.

- [ ] **Step 1: Add scripts to `bun/package.json`**

Modify the `scripts` block (keep existing entries):

```json
"scripts": {
  "dev": "bun run src/index.ts",
  "build": "bun run build.ts",
  "build:host": "bun build --compile --target=bun --minify src/index.ts --outfile dist/ccws-host",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:integration": "bun run build:host && vitest run tests/integration",
  "typecheck": "tsc --noEmit",
  "check": "bun run typecheck && bun run test && bun run test:integration"
}
```

- [ ] **Step 2: Verify**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run typecheck
bun run check
```

Expected: typecheck clean; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add bun/package.json
git commit -m "chore(bun): add build:host / test:integration / check scripts"
```

---

## Phase G — Distribution + cutover (Tasks 28-38)

The binary is feature-complete. Now we ship it as the install target, prove it works against the existing bats suite, then atomically delete bash.

### Task 28: install.sh — binary download mode

**Files:**
- Modify: `install.sh`
- Modify: `bun/src/version.ts` (bump to `0.7.0` → leave alone; bump happens just before v1.0 in Task 37)

The new `install.sh` is a downloader. It detects platform, downloads the right binary from GitHub Releases at a pinned tag, places it at `~/.local/bin/ccws`, and writes the shell rc lines. Bash dispatcher path becomes a fallback that activates only if `--from-source` is passed (developer mode).

Why this is two-stage: install.sh ships in Phase G so users get the new install path before bash is deleted in Task 38; tasks 29-35 prove the binary at v0.7.0 alongside the bash code.

- [ ] **Step 1: Rewrite `install.sh`**

```bash
#!/usr/bin/env bash
# ccws installer — downloads the compiled binary from GitHub Releases.
# Use --from-source to link the bash dispatcher instead (developer mode).
set -euo pipefail

REPO="kolapapa/ccws"
INSTALL_BIN="$HOME/.local/bin"
PICKER_BIN_DIR="$HOME/.ccws/bin"

write_shell_rc=1
enable_claude_wrapper=0
from_source=0
version=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --no-shell-rc)         write_shell_rc=0; shift ;;
        --with-claude-wrapper) enable_claude_wrapper=1; shift ;;
        --from-source)         from_source=1; shift ;;
        --version)             version="$2"; shift 2 ;;
        --help|-h)
            cat <<'EOF'
ccws installer

Usage: ./install.sh [--no-shell-rc] [--with-claude-wrapper] [--from-source] [--version vX.Y.Z]

  --no-shell-rc          Don't touch ~/.bashrc / ~/.zshrc / fish config
  --with-claude-wrapper  Also enable the opt-in claude() wrapper
  --from-source          Symlink bash bin/ccws instead of downloading binary
                         (developer mode — requires this repo cloned)
  --version vX.Y.Z       Pin to a specific release (default: latest)

After install, run:  ccws init
EOF
            exit 0 ;;
        *) echo "unknown flag: $1" >&2; exit 2 ;;
    esac
done

detect_platform() {
    local os arch
    case "$(uname -s)" in
        Darwin) os="darwin" ;;
        Linux)  os="linux" ;;
        *) echo "unsupported OS: $(uname -s)" >&2; exit 1 ;;
    esac
    case "$(uname -m)" in
        arm64|aarch64) arch="arm64" ;;
        x86_64|amd64)  arch="x64" ;;
        *) echo "unsupported arch: $(uname -m)" >&2; exit 1 ;;
    esac
    printf '%s-%s' "$os" "$arch"
}

echo "ccws installer"

mkdir -p "$INSTALL_BIN"

if [[ "$from_source" -eq 1 ]]; then
    CCWS_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    ln -sfn "$CCWS_SRC/bin/ccws" "$INSTALL_BIN/ccws"
    echo "✓ Linked source bin/ccws to $INSTALL_BIN/ccws"
else
    plat=$(detect_platform)
    if [[ -z "$version" ]]; then
        version=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name": *"\(v[^"]*\)".*/\1/p')
        if [[ -z "$version" ]]; then
            echo "Could not detect latest release tag — pass --version vX.Y.Z" >&2
            exit 1
        fi
    fi

    url_ccws="https://github.com/$REPO/releases/download/$version/ccws-$plat"
    url_picker="https://github.com/$REPO/releases/download/$version/ccws-picker-$plat"

    echo "  Downloading $version ($plat)..."
    curl -fsSL "$url_ccws" -o "$INSTALL_BIN/ccws"
    chmod +x "$INSTALL_BIN/ccws"
    echo "  ✓ ccws → $INSTALL_BIN/ccws"

    mkdir -p "$PICKER_BIN_DIR"
    curl -fsSL "$url_picker" -o "$PICKER_BIN_DIR/ccws-picker"
    chmod +x "$PICKER_BIN_DIR/ccws-picker"
    echo "  ✓ ccws-picker → $PICKER_BIN_DIR/ccws-picker"
fi

if [[ "$write_shell_rc" -eq 1 ]]; then
    echo ""
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
        [[ -f "$rc" ]] || continue
        if grep -qE "ccws hook|ccws/share/init" "$rc"; then
            echo "  (skipped — $rc already wired)"
            continue
        fi
        shell_name="${rc##*/.}"; shell_name="${shell_name%rc}"
        {
            echo ""
            echo "# ccws — Claude Code WorkSpace"
            echo "eval \"\$(ccws hook --shell $shell_name)\""
            if [[ "$enable_claude_wrapper" -eq 1 ]]; then
                echo "eval \"\$(ccws hook --claude)\""
            else
                echo "# Uncomment to let 'claude' auto-resolve .ccws-workspace / global:"
                echo "# eval \"\$(ccws hook --claude)\""
            fi
        } >> "$rc"
        echo "✓ Added ccws hook to $rc"
    done
    fish_conf="$HOME/.config/fish/config.fish"
    if [[ -f "$fish_conf" ]] && ! grep -qE "ccws hook|ccws/share/init" "$fish_conf"; then
        {
            echo ""
            echo "# ccws — Claude Code WorkSpace"
            echo "ccws hook --shell fish | source"
            if [[ "$enable_claude_wrapper" -eq 1 ]]; then
                echo "ccws hook --claude | source"
            else
                echo "# Uncomment to let 'claude' auto-resolve scope:"
                echo "# ccws hook --claude | source"
            fi
        } >> "$fish_conf"
        echo "✓ Added ccws hook to $fish_conf"
    fi
fi

echo ""
echo "Installed. Next:"
echo "  1. Restart your shell or 'source' your rc file"
echo "  2. Run: ccws init"
```

- [ ] **Step 2: Verify it parses (no execution — we'll run it in Task 33 against a fake release)**

```bash
bash -n /Users/kola/workspace/ccws-bun/install.sh
```

Expected: no output (syntax ok).

- [ ] **Step 3: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add install.sh
git commit -m "feat(install): download compiled binary from GitHub Releases by default"
```

---

### Task 29: build.ts — add ccws (full CLI) target

**Files:**
- Modify: `bun/build.ts`

Phase 1's `build.ts` builds only `ccws-picker-*`. Now we need both:
- `ccws-picker-*` — the same binary as before (still used by `lib/tui.sh` until Task 38)
- `ccws-*` — the full CLI binary that will replace `bin/ccws` at install time

Both compile from the same entry point (`src/index.ts`) because `dispatch` handles all subcommands and `runPicker` is the no-arg default. We just emit two filenames pointing at the same compiled output.

- [ ] **Step 1: Modify `bun/build.ts`**

```typescript
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
    // Build once
    const ok = await buildOne(triple, cliOut);
    if (!ok) { failed++; continue; }
    // Copy the same binary to the picker filename (identical bytes; the bash
    // bridge invokes ccws-picker, which today is just `ccws` with no args)
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
```

- [ ] **Step 2: Build all targets**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run build
ls dist/
```

Expected: 8 files — `ccws-{darwin,linux}-{arm64,x64}` and `ccws-picker-{darwin,linux}-{arm64,x64}`.

- [ ] **Step 3: Smoke test the host binary**

```bash
./dist/ccws-darwin-arm64 --version 2>/dev/null || ./dist/ccws-linux-x64 --version
```

Expected: `ccws 0.7.0`.

- [ ] **Step 4: Commit**

```bash
cd /Users/kola/workspace/ccws-bun
git add bun/build.ts
git commit -m "build(bun): emit ccws-<platform> alongside ccws-picker-<platform>"
```

---

### Task 30: GitHub Actions — upload ccws + ccws-picker

**Files:**
- Modify: `.github/workflows/release.yml`

The release workflow currently uploads only `ccws-picker-*`. Add `ccws-*` to the artifact list.

- [ ] **Step 1: Read the existing workflow**

```bash
cat /Users/kola/workspace/ccws-bun/.github/workflows/release.yml
```

- [ ] **Step 2: Modify the upload step to glob both names**

In the "Create release" / upload step (whatever the existing file calls it), change the `files:` block to include both prefixes. Concretely, if it has lines like:

```yaml
files: bun/dist/ccws-picker-*
```

replace with:

```yaml
files: |
  bun/dist/ccws-*
```

The single glob covers both `ccws-darwin-arm64` and `ccws-picker-darwin-arm64`. Verify by hand that the glob doesn't accidentally match unrelated files in `bun/dist/` (it shouldn't — only the build artifacts are there).

- [ ] **Step 3: Regenerate the checksums step**

If the workflow has a `sha256sum` step that produces `SHA256SUMS`, update it to include both naming patterns:

```yaml
- name: Generate SHA256SUMS
  working-directory: bun/dist
  run: |
    shasum -a 256 ccws-* > SHA256SUMS
```

Add `bun/dist/SHA256SUMS` to the upload files list.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci(release): upload ccws-<platform> binaries alongside ccws-picker"
```

---

### Task 31: integration tests — share/init.sh against the binary

**Files:**
- Create: `bun/tests/integration/shell.test.ts`

This is the highest-value integration test. It verifies that the compiled binary's stdout is still bash-eval-able and that `share/init.sh` still does its job (the protocol). If this passes, deleting bash in Task 38 is safe for shell users.

- [ ] **Step 1: Write the test**

```typescript
// bun/tests/integration/shell.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const REPO = join(import.meta.dir, '../../..');           // ccws-bun worktree root
const BIN = join(REPO, 'bun/dist/ccws-host');
const INIT_SH = join(REPO, 'share/init.sh');

async function bash(script: string, env: Record<string, string>): Promise<{ stdout: string; stderr: string; code: number }> {
  const p = Bun.spawn({
    cmd: ['bash', '-c', script],
    stdout: 'pipe', stderr: 'pipe',
    env: { PATH: process.env.PATH ?? '', ...env },
  });
  const [stdout, stderr] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  return { stdout, stderr, code: await p.exited };
}

describe('share/init.sh + binary', () => {
  let tmp: string;
  beforeAll(() => {
    if (!existsSync(BIN)) throw new Error(`Build first: bun run build:host`);
    if (!existsSync(INIT_SH)) throw new Error(`share/init.sh missing at ${INIT_SH}`);
  });
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-shell-'));
    // Symlink the binary as `ccws` in a fake bin/ dir so PATH picks it up
    mkdirSync(join(tmp, 'bin'));
    symlinkSync(BIN, join(tmp, 'bin/ccws'));
    // Provide CCWS_DIR pointing at a fake repo so init.sh resolves itself
    mkdirSync(join(tmp, 'repo'));
    mkdirSync(join(tmp, 'repo/share'));
    // Copy init.sh into the fake repo
    Bun.write(join(tmp, 'repo/share/init.sh'), Bun.file(INIT_SH));
  });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('source init.sh; ccws list — works end-to-end', async () => {
    const r = await bash(
      `source "${tmp}/repo/share/init.sh"; ccws list`,
      { HOME: tmp, CCWS_ROOT: join(tmp, '.ccws'), PATH: `${tmp}/bin:${process.env.PATH}` },
    );
    expect(r.code).toBe(0);
    expect(r.stderr).toMatch(/no workspaces yet/);
  });

  it('ccws use sets CCWS_NAME and CLAUDE_CONFIG_DIR in the shell', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/work'), { recursive: true });
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'), 'CCWS_NAME=work\nANTHROPIC_BASE_URL=https://api.x\n');
    const r = await bash(
      `source "${tmp}/repo/share/init.sh"; ccws use work; printf 'name=%s url=%s\\n' "$CCWS_NAME" "$ANTHROPIC_BASE_URL"`,
      { HOME: tmp, CCWS_ROOT: join(tmp, '.ccws'), PATH: `${tmp}/bin:${process.env.PATH}` },
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('name=work url=https://api.x');
  });

  it('ccws unset clears the vars', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/work'), { recursive: true });
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'), 'CCWS_NAME=work\nANTHROPIC_BASE_URL=https://api.x\n');
    const r = await bash(
      `source "${tmp}/repo/share/init.sh"; ccws use work; ccws unset; printf '%s|%s' "${'${CCWS_NAME:-(none)}'}" "${'${ANTHROPIC_BASE_URL:-(none)}'}"`,
      { HOME: tmp, CCWS_ROOT: join(tmp, '.ccws'), PATH: `${tmp}/bin:${process.env.PATH}` },
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('(none)|(none)');
  });
});
```

- [ ] **Step 2: Run the test**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run build:host
bunx vitest run tests/integration/shell.test.ts
```

Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add bun/tests/integration/shell.test.ts
git commit -m "test(integration): share/init.sh + compiled binary end-to-end"
```

---

### Task 32: fish wrapper integration test

**Files:**
- Create: `bun/tests/integration/fish.test.ts`

Same shape as the bash test, but for fish. Skipped automatically if fish isn't installed.

- [ ] **Step 1: Write the test**

```typescript
// bun/tests/integration/fish.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const REPO = join(import.meta.dir, '../../..');
const BIN = join(REPO, 'bun/dist/ccws-host');
const INIT_FISH = join(REPO, 'share/init.fish');

async function fish(script: string, env: Record<string, string>): Promise<{ stdout: string; stderr: string; code: number }> {
  const p = Bun.spawn({
    cmd: ['fish', '-c', script],
    stdout: 'pipe', stderr: 'pipe',
    env: { PATH: process.env.PATH ?? '', ...env },
  });
  const [stdout, stderr] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text()]);
  return { stdout, stderr, code: await p.exited };
}

const fishInstalled = await (async () => {
  try {
    const p = Bun.spawn({ cmd: ['fish', '--version'], stdout: 'pipe', stderr: 'pipe' });
    return (await p.exited) === 0;
  } catch { return false; }
})();

describe.skipIf(!fishInstalled)('share/init.fish + binary', () => {
  let tmp: string;
  beforeAll(() => {
    if (!existsSync(BIN)) throw new Error(`Build first: bun run build:host`);
    if (!existsSync(INIT_FISH)) throw new Error(`share/init.fish missing at ${INIT_FISH}`);
  });
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'ccws-fish-'));
    mkdirSync(join(tmp, 'bin'));
    symlinkSync(BIN, join(tmp, 'bin/ccws'));
    mkdirSync(join(tmp, 'repo/share'), { recursive: true });
    Bun.write(join(tmp, 'repo/share/init.fish'), Bun.file(INIT_FISH));
  });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it('source init.fish; ccws use sets the vars', async () => {
    mkdirSync(join(tmp, '.ccws/workspaces/work'), { recursive: true });
    writeFileSync(join(tmp, '.ccws/workspaces/work/ccws.env'), 'CCWS_NAME=work\nANTHROPIC_BASE_URL=https://api.x\n');
    const r = await fish(
      `source ${tmp}/repo/share/init.fish; ccws use work; printf 'name=%s url=%s\\n' "$CCWS_NAME" "$ANTHROPIC_BASE_URL"`,
      { HOME: tmp, CCWS_ROOT: join(tmp, '.ccws'), PATH: `${tmp}/bin:${process.env.PATH}` },
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('name=work url=https://api.x');
  });
});
```

- [ ] **Step 2: Run the test (skipped on machines without fish)**

```bash
bunx vitest run tests/integration/fish.test.ts
```

Expected: 1 passed if fish is installed, 1 skipped otherwise.

- [ ] **Step 3: Commit**

```bash
git add bun/tests/integration/fish.test.ts
git commit -m "test(integration): share/init.fish + binary on systems with fish"
```

---

### Task 33: dogfood — replace local `ccws` with the new binary

**Files:** none (local-environment task only)

This is a manual checkpoint, not a code change. Run the binary as your real `ccws` for a day and verify it doesn't regress.

- [ ] **Step 1: Build the host binary**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run build:host
```

- [ ] **Step 2: Replace the symlink in `~/.local/bin`**

Back up the existing binary, swap in the new one, and re-shim the picker:

```bash
# Snapshot what's installed now
ls -la ~/.local/bin/ccws ~/.ccws/bin/ccws-picker 2>/dev/null

# Move the current ccws aside (might be a bash symlink, might be a binary)
mv ~/.local/bin/ccws ~/.local/bin/ccws.bak 2>/dev/null || true

# Link the new binary as ccws and also re-use it as the picker
ln -sfn /Users/kola/workspace/ccws-bun/bun/dist/ccws-host ~/.local/bin/ccws
mkdir -p ~/.ccws/bin
ln -sfn /Users/kola/workspace/ccws-bun/bun/dist/ccws-host ~/.ccws/bin/ccws-picker
```

- [ ] **Step 3: Sanity check in a fresh shell**

Open a new terminal (so `share/init.sh` reloads):

```bash
which ccws
ccws --version
ccws list
ccws current
ccws which
ccws hook --shell zsh
```

Expected: `ccws 0.7.0`, your workspaces show up, `hook` emits a `source` line that points to a valid file.

- [ ] **Step 4: Round-trip use → unset**

```bash
ccws use gradient
echo "$CCWS_NAME $CLAUDE_CONFIG_DIR"
ccws unset
echo "after unset: ${CCWS_NAME:-(none)} ${CLAUDE_CONFIG_DIR:-(none)}"
```

Expected: vars set after `use`, cleared after `unset`.

- [ ] **Step 5: Picker**

```bash
ccws
# (Esc out — verify it renders, ↑↓ work, Tab toggles dangerous, Enter selects)
```

- [ ] **Step 6: Run for at least 30 minutes of real work**

Use ccws to switch workspaces, add a throwaway workspace, remove it, re-list, etc. Note any regression — fix it in a small follow-up task before continuing.

- [ ] **Step 7: If anything breaks, revert immediately**

```bash
mv ~/.local/bin/ccws.bak ~/.local/bin/ccws 2>/dev/null || true
```

Then file a fix task. Do not proceed to Task 34 until the binary survives a half-day of normal use without surprises.

- [ ] **Step 8: When clean, no commit needed — just record completion in the task list**

---

### Task 34: docs — update README install section

**Files:**
- Modify: `README.md`

Mirror the new install model in the README. Three pieces: (a) one-liner curl install, (b) `--from-source` developer mode, (c) `ccws --version` sanity check.

- [ ] **Step 1: Find and replace the install block**

Find the section under `## Install` (or similar) in `README.md` and replace the body with:

```markdown
## Install

```bash
curl -fsSL https://raw.githubusercontent.com/kolapapa/ccws/main/install.sh | bash
```

This downloads the latest binary for your platform from [GitHub Releases](https://github.com/kolapapa/ccws/releases), drops it at `~/.local/bin/ccws`, wires `ccws hook` into your shell rc, and sets up `~/.ccws/bin/ccws-picker` for the picker.

Verify:

```bash
ccws --version       # ccws 0.7.0
```

Then run `ccws init`.

### Developer mode

If you've cloned the repo and want to use the source tree:

```bash
./install.sh --from-source
```

This symlinks `bin/ccws` (bash dispatcher) into `~/.local/bin/ccws`. Use this if you're developing ccws — your edits to `bin/ccws` / `lib/*.sh` take effect immediately.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(install): document binary curl|bash install + --from-source mode"
```

---

### Task 35: pin the install.sh version and ship v0.7.1

**Files:**
- Modify: `bun/src/version.ts`
- Create: tag `v0.7.1`

Why a patch release here: we changed the install protocol (binary download), the CI workflow (added ccws-* artifacts), and the README. None of this changes runtime behavior, so it's a PATCH bump per the project's versioning rule.

- [ ] **Step 1: Bump version**

```typescript
// bun/src/version.ts
export const VERSION = '0.7.1';
```

Also update `bun/package.json`'s `"version"` field to `"0.7.1"`.

- [ ] **Step 2: Run the full suite**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run check
```

Expected: typecheck clean; vitest passes; integration suite passes.

- [ ] **Step 3: Update the integration test that asserts the version regex**

In `bun/tests/integration/binary.test.ts`, the `--version` assertion is already a generic regex (`/^ccws \d+\.\d+\.\d+\n$/`), so no change needed. Verify by re-running.

- [ ] **Step 4: Commit + tag**

```bash
cd /Users/kola/workspace/ccws-bun
git add bun/src/version.ts bun/package.json
git commit -m "chore(release): bump to v0.7.1 — install.sh now downloads binary"
git tag v0.7.1
```

- [ ] **Step 5: When this branch lands on `main`, push the tag**

This step is reserved for the merge dance in the finishing-a-development-branch skill — do NOT push the tag from inside the worktree. The tag travels with the merged commit on main.

---

### Task 36: prove the existing bats suite still passes

**Files:** none (verification only)

This is the safety net before deleting bash. The existing bats tests under `tests/integration/` test the bash dispatcher's behavior. They must still pass — even though we're about to delete the code they test — because they're our regression guard during Task 38's deletion. If a bats test fails, the binary's behavior diverges from bash's behavior, and Task 38 would ship a regression.

- [ ] **Step 1: Run bats**

```bash
cd /Users/kola/workspace/ccws-bun
bats tests/integration/
```

Expected: all currently-green bats files still pass. If any new failures, they're caused by the install.sh or workflow changes from earlier tasks — investigate and fix.

- [ ] **Step 2: Spot-check a few flows directly with the binary**

```bash
HOME=/tmp/ccws-smoke CCWS_ROOT=/tmp/ccws-smoke/.ccws ./bun/dist/ccws-host add demo --base-url https://x --token sk-1 --non-interactive
HOME=/tmp/ccws-smoke CCWS_ROOT=/tmp/ccws-smoke/.ccws ./bun/dist/ccws-host list
HOME=/tmp/ccws-smoke CCWS_ROOT=/tmp/ccws-smoke/.ccws ./bun/dist/ccws-host use demo
HOME=/tmp/ccws-smoke CCWS_ROOT=/tmp/ccws-smoke/.ccws ./bun/dist/ccws-host rm demo -f
```

Expected: all four commands succeed. The `list` shows `demo`, `use` emits eval-able exports, `rm -f` deletes silently.

- [ ] **Step 3: Document any bats-only behavior we're intentionally dropping**

If you noticed during the rewrite that some bats test asserts a bash-specific behavior we explicitly chose NOT to mirror (e.g., bash 3.2 quirks, exact whitespace in deprecated log lines), note them in a comment at the top of the corresponding bats file with `# TS rewrite: this case is dropped because ...`. Don't fix the test — it'll be deleted in Task 38.

- [ ] **Step 4: No commit unless you added a comment in Step 3**

If you added comments:

```bash
git add tests/integration/<file>.bats
git commit -m "docs(tests): annotate bash-only quirks we intentionally don't mirror"
```

---

### Task 37: bump to v1.0.0

**Files:**
- Modify: `bun/src/version.ts`
- Modify: `bun/package.json`

v1.0 is the milestone where bash code is deleted. We bump now (before Task 38) so the final tag matches the cutover commit.

- [ ] **Step 1: Bump version**

```typescript
// bun/src/version.ts
export const VERSION = '1.0.0';
```

```json
// bun/package.json — change "version" field
"version": "1.0.0",
```

- [ ] **Step 2: Verify**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run check
```

Expected: all green.

- [ ] **Step 3: Commit (no tag yet — Task 38 ships the same release)**

```bash
git add bun/src/version.ts bun/package.json
git commit -m "chore(release): bump to v1.0.0"
```

---

### Task 38: delete bash — atomic cutover

**Files:** many deletions. This is the largest commit in the plan and the most carefully scoped.

What goes away:
- `bin/ccws` (bash dispatcher)
- All of `lib/`: `common.sh`, `env.sh`, `lock.sh`, `scope.sh`, `symlink_farm.sh`, `tui.sh`, `tui_fzf.sh`, `tui_fallback.sh`, `tui_gum.sh`, and every `cmd_*.sh`
- `tests/integration/*.bats` and `tests/helpers/*`
- `tests/` directory (now empty)

What stays:
- `share/init.sh`, `share/init.fish`, `share/claude-wrapper.sh`, `share/commands/*.md` — required by the hook eval
- `install.sh` — the binary downloader
- `bun/` — the TS source + tests + build pipeline
- `README.md`, `DESIGN.md`, `docs/`, license, etc.

The `install.sh --from-source` flag becomes a no-op because there's no `bin/ccws` to link. We replace it in this task with a friendly error.

- [ ] **Step 1: Delete bash code**

```bash
cd /Users/kola/workspace/ccws-bun
git rm bin/ccws
git rm -r lib/
git rm -r tests/
```

- [ ] **Step 2: Update install.sh to drop --from-source**

In `install.sh`, change the `--from-source` branch to:

```bash
if [[ "$from_source" -eq 1 ]]; then
    echo "error: --from-source is no longer supported (bash entry point removed in v1.0)" >&2
    echo "Build from source instead:" >&2
    echo "  cd bun && bun install && bun run build:host" >&2
    echo "  ln -sfn \$(pwd)/dist/ccws-host \$HOME/.local/bin/ccws" >&2
    exit 2
fi
```

Also remove the `--from-source` line from the `--help` output.

- [ ] **Step 3: Verify install.sh still parses**

```bash
bash -n install.sh
```

Expected: no output.

- [ ] **Step 4: Run the binary-side suite once more**

```bash
cd bun
bun run check
```

Expected: all green. (No bats — we just deleted it.)

- [ ] **Step 5: Verify the working tree**

```bash
cd /Users/kola/workspace/ccws-bun
ls -la
```

Expected top-level: `.git`, `.github`, `bun/`, `docs/`, `share/`, `install.sh`, `README.md`, `DESIGN.md`, `LICENSE` (if present). No `bin/`, `lib/`, `tests/`.

- [ ] **Step 6: Verify share/init.sh still works with the new binary**

```bash
cd /Users/kola/workspace/ccws-bun/bun
bun run build:host
HOME=/tmp/ccws-final CCWS_ROOT=/tmp/ccws-final/.ccws bash -c '
  source /Users/kola/workspace/ccws-bun/share/init.sh
  /Users/kola/workspace/ccws-bun/bun/dist/ccws-host --version
'
```

Expected: `ccws 1.0.0`.

- [ ] **Step 7: Commit the cutover**

```bash
cd /Users/kola/workspace/ccws-bun
git add -A
git commit -m "feat!: v1.0.0 — bun binary is canonical, bash removed

BREAKING CHANGE: bin/ccws and lib/*.sh are deleted. The compiled ccws binary
is now the only entry point. install.sh downloads the binary by default;
'--from-source' is replaced with a build instruction. share/init.sh and
share/init.fish are unchanged — the eval protocol round-trips byte-equivalent
through the new binary."
```

- [ ] **Step 8: Tag v1.0.0**

```bash
git tag v1.0.0
```

- [ ] **Step 9: Hand off**

After this commit, use `superpowers:finishing-a-development-branch` to merge `spec/bun-rewrite` to `main` and push the tag — the release workflow will then publish all four binaries to GitHub Releases under `v1.0.0`.

---

## Self-review checklist

Run this checklist after all 38 tasks are committed:

- [ ] `find . -name '*.sh' -path './lib/*' -o -name '*.bats'` returns nothing.
- [ ] `grep -r "ccws_cmd_" .` returns only docs (no source code references).
- [ ] `./bun/dist/ccws-host --help` shows every documented subcommand.
- [ ] Every `lib/cmd_*.sh` from Phase 1 has a corresponding `bun/src/commands/*.ts`.
- [ ] `bash -c 'source share/init.sh; type ccws'` reports a function (the wrapper is intact).
- [ ] `bun run check` is green.
- [ ] `git log --oneline spec/bun-rewrite | wc -l` is around 16 (Phase 1) + 38 (this plan) ≈ 54 commits.

---

## Notes for the implementer

1. **Don't mix tasks.** Each task is one commit. If you discover a missing piece mid-task, add it to the same task (and the same commit) — don't open a new uncommitted chunk.

2. **Don't optimize prematurely.** The TS code can look like a direct translation of the bash. We can re-architect later if needed; correctness first.

3. **The eval protocol is sacred.** `ccws use` and `ccws unset` outputs are evaluated by `share/init.sh`. Any byte change can break user shells. Always test by piping into `bash -c` (Task 4's round-trip pattern, repeated in Tasks 10, 31, 32).

4. **bun + react-devtools-core lesson.** Phase 1 hit a bug where `--external react-devtools-core` removed the package from the bundle but kept the `require()` call, crashing the binary at runtime. Don't add `--external` flags. If a bundling problem appears, add the package to real `dependencies` and let bun bundle it.

5. **`process.exit(0)` inside tested modules is a footgun.** It terminates vitest mid-run. The convention "command modules return a number; only `index.ts` calls `process.exit`" keeps the test runner alive.

6. **Bun-test vs vitest.** This plan uses vitest (Phase 1's choice). `bun test` runs vitest because we configured it that way in `package.json`. Don't switch to `bun:test` mid-plan — they have different APIs.
