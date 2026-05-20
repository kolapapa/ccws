import { spawnSync } from 'node:child_process';

// Polyfill Bun.spawn for vitest/Node environment
if (typeof globalThis.Bun === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).Bun = {
    spawn(opts: { cmd: string[]; stdout?: string }) {
      const [bin, ...args] = opts.cmd as [string, ...string[]];
      const result = spawnSync(bin, args, {
        encoding: 'buffer',
        stdio: ['inherit', opts.stdout === 'pipe' ? 'pipe' : 'inherit', 'inherit'],
      });
      const outputBuffer = result.stdout ?? Buffer.alloc(0);
      return {
        stdout: new ReadableStream({
          start(controller) {
            controller.enqueue(outputBuffer);
            controller.close();
          },
        }),
      };
    },
  };
}
