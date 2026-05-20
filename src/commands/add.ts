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
  binary: string;
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

  if (parsed.name === '' && !parsed.nonInteractive) {
    parsed.name = await promptLine('Workspace name: ');
    if (parsed.name === '') { logError('name required'); return 2; }
  }

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
