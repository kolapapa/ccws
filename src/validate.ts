const RESERVED = new Set([
  'add', 'init', 'list', 'use', 'unset', 'current', 'rm', 'sync',
  'doctor', 'tui', 'none', 'default-tui', 'local', 'global', 'which', 'hook',
  'switch',
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
