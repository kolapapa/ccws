function write(line: string): void {
  process.stderr.write(`${line}\n`);
}

export function logInfo(msg: string): void  { write(`ccws: ${msg}`); }
export function logWarn(msg: string): void  { write(`ccws: warn: ${msg}`); }
export function logError(msg: string): void { write(`ccws: error: ${msg}`); }
export function logOk(msg: string): void    { write(`ccws: ok: ${msg}`); }
