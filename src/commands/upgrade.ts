import { chmodSync, lstatSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERSION } from '../version.js';
import { logError } from '../logger.js';

const REPO = 'kolapapa/ccws';

const USAGE = `Usage: ccws upgrade [--check] [--version vX.Y.Z]

Upgrade ccws to the latest GitHub release (or a specific version).

  --check               Print "current → latest" and exit; don't download.
  --version vX.Y.Z      Install this version (pin, or downgrade) instead of latest.
  -h, --help            Show this help.

After upgrade, restart your shell so the ccws() hook re-evals:
    exec $SHELL -l
`;

export interface UpgradeArgs {
  check: boolean;
  version: string;     // empty string = "latest"
  showHelp: boolean;
}

export function parseUpgradeArgs(argv: string[]): UpgradeArgs | { error: string } {
  let check = false;
  let version = '';
  let showHelp = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') { check = true; continue; }
    if (a === '--version') {
      const v = argv[i + 1];
      if (v === undefined || v.startsWith('-')) return { error: '--version requires a value (e.g. v1.0.1)' };
      version = v;
      i++;
      continue;
    }
    if (a === '-h' || a === '--help') { showHelp = true; continue; }
    return { error: `unknown flag: ${a}` };
  }
  return { check, version, showHelp };
}

interface Platform {
  os: 'darwin' | 'linux';
  arch: 'arm64' | 'x64';
  label: string;       // e.g. "darwin-arm64"
}

function detectPlatform(): Platform | { error: string } {
  let os: Platform['os'];
  switch (process.platform) {
    case 'darwin': os = 'darwin'; break;
    case 'linux':  os = 'linux';  break;
    default: return { error: `unsupported OS: ${process.platform} (only darwin and linux have prebuilt binaries)` };
  }
  let arch: Platform['arch'];
  switch (process.arch) {
    case 'arm64': arch = 'arm64'; break;
    case 'x64':   arch = 'x64';   break;
    default: return { error: `unsupported arch: ${process.arch}` };
  }
  return { os, arch, label: `${os}-${arch}` };
}

async function fetchLatestTag(): Promise<string> {
  const url = `https://api.github.com/repos/${REPO}/releases/latest`;
  const res = await fetch(url, { headers: { 'User-Agent': `ccws/${VERSION}`, 'Accept': 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub API returned ${res.status} ${res.statusText} for ${url}`);
  const body = await res.json() as { tag_name?: string };
  if (typeof body.tag_name !== 'string' || body.tag_name === '') {
    throw new Error('GitHub API response missing tag_name');
  }
  return body.tag_name;
}

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function renderProgress(downloaded: number, total: number, isTTY: boolean, final: boolean): void {
  const dl = formatMB(downloaded);
  const line = total > 0
    ? `  Downloading: ${dl} / ${formatMB(total)} MB (${Math.floor((downloaded / total) * 100)}%)`
    : `  Downloading: ${dl} MB`;
  if (isTTY) {
    // \r returns to col 0; \x1b[K clears to end-of-line so a shorter line
    // doesn't leave trailing characters from a previous longer line.
    process.stdout.write(`\r\x1b[K${line}${final ? '\n' : ''}`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

async function downloadBinary(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { headers: { 'User-Agent': `ccws/${VERSION}` } });
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText} for ${url}`);
  if (res.body === null) throw new Error(`download failed: empty response body for ${url}`);

  const total = Number(res.headers.get('content-length') ?? '0');
  const isTTY = process.stdout.isTTY === true;
  const intervalMs = isTTY ? 100 : 1000;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let downloaded = 0;
  let lastEmit = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    downloaded += value.byteLength;
    const now = Date.now();
    if (now - lastEmit >= intervalMs) {
      lastEmit = now;
      renderProgress(downloaded, total, isTTY, false);
    }
  }
  renderProgress(downloaded, total, isTTY, true);

  const buf = new Uint8Array(downloaded);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }

  const tmp = `${dest}.upgrade-tmp`;
  writeFileSync(tmp, buf);
  chmodSync(tmp, 0o755);
  // POSIX rename is atomic on the same filesystem. Running process keeps the
  // old inode open until exit, so replacing the binary mid-run is safe.
  renameSync(tmp, dest);
}

function refuseSymlink(path: string, label: string): string | null {
  try {
    const st = lstatSync(path);
    if (st.isSymbolicLink()) {
      return `refusing to overwrite ${label} at ${path} — it's a symlink (dev mode). Rebuild with 'bun run build:host' instead.`;
    }
  } catch {
    // Doesn't exist yet — that's fine, fetch will create it.
  }
  return null;
}

function normalizeTag(s: string): string {
  // Accept both "v1.0.1" and "1.0.1"; emit canonical "v1.0.1" for URLs.
  return s.startsWith('v') ? s : `v${s}`;
}

export async function runUpgrade(argv: string[]): Promise<number> {
  const parsed = parseUpgradeArgs(argv);
  if ('error' in parsed) {
    logError(parsed.error);
    process.stderr.write(USAGE);
    return 2;
  }
  if (parsed.showHelp) {
    process.stderr.write(USAGE);
    return 0;
  }

  const plat = detectPlatform();
  if ('error' in plat) {
    logError(plat.error);
    return 1;
  }

  const currentTag = normalizeTag(VERSION);
  let targetTag: string;
  if (parsed.version !== '') {
    targetTag = normalizeTag(parsed.version);
  } else {
    try {
      targetTag = await fetchLatestTag();
    } catch (e) {
      logError(`could not fetch latest release: ${(e as Error).message}`);
      return 1;
    }
  }

  if (parsed.check) {
    if (currentTag === targetTag) {
      process.stdout.write(`ccws ${currentTag} (latest)\n`);
    } else {
      process.stdout.write(`ccws ${currentTag} → ${targetTag} available\n`);
      process.stdout.write(`Run 'ccws upgrade' to install.\n`);
    }
    return 0;
  }

  if (currentTag === targetTag && parsed.version === '') {
    process.stdout.write(`Already on latest (${currentTag}).\n`);
    return 0;
  }

  const ccwsPath = realpathSync(process.execPath);
  const err = refuseSymlink(ccwsPath, 'ccws binary');
  if (err !== null) { logError(err); return 1; }

  const ccwsUrl = `https://github.com/${REPO}/releases/download/${targetTag}/ccws-${plat.label}`;

  process.stdout.write(`ccws ${currentTag} → ${targetTag} (${plat.label})\n`);
  try {
    await downloadBinary(ccwsUrl, ccwsPath);
    process.stdout.write(`  ✓ ${ccwsPath}\n`);
  } catch (e) {
    logError(`upgrade failed: ${(e as Error).message}`);
    return 1;
  }

  // Best-effort cleanup of the legacy ccws-picker copy from pre-v1.x installs.
  const home = process.env.HOME ?? '';
  if (home !== '') {
    try { unlinkSync(join(home, '.ccws', 'bin', 'ccws-picker')); } catch { /* not there, fine */ }
  }

  process.stdout.write(`\nRestart your shell so the hook re-evals:\n`);
  process.stdout.write(`    exec $SHELL -l\n`);
  return 0;
}
