import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { nextWorkspaceFile, wsDir } from '../paths.js';
import { validateName } from '../validate.js';
import { logError, logOk } from '../logger.js';

// Arms an account switch for the next `claude` launch. Claude can't change the
// running shell's env, so `/switch <name>` records the target workspace (and the
// session id to resume) in a marker file; the claude() wrapper consumes it after
// the session exits and relaunches under the new account.
//
//   ccws switch <name> [session-id]   arm the switch
//   ccws switch --pop                 print "name [sessionid]" and delete marker
export async function runSwitch(argv: string[]): Promise<number> {
  if (argv[0] === '--pop') return pop();

  const name = argv[0];
  if (name === undefined || name.startsWith('-')) {
    logError('usage: ccws switch <name> [session-id]');
    return 2;
  }

  const v = validateName(name);
  if (!v.ok) { logError(v.reason); return 2; }
  if (!existsSync(wsDir(name))) {
    logError(`workspace '${name}' does not exist (use 'ccws add ${name}' first)`);
    return 1;
  }
  if (name === process.env.CCWS_NAME) {
    logError(`already on workspace '${name}'`);
    return 1;
  }

  const sessionId = argv[1] ?? '';
  writeFileSync(nextWorkspaceFile(), `${name}\n${sessionId}\n`);
  logOk(`switch armed → '${name}'; exit this session (Ctrl-D) to continue there`);
  return 0;
}

function pop(): number {
  const marker = nextWorkspaceFile();
  if (!existsSync(marker)) return 0;
  const [name = '', sessionId = ''] = readFileSync(marker, 'utf8').split('\n');
  unlinkSync(marker);
  if (name === '') return 0;
  process.stdout.write(sessionId === '' ? `${name}\n` : `${name} ${sessionId}\n`);
  return 0;
}
