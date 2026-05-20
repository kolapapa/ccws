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
