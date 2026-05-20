export function shQuote(value: string): string {
  if (value === '') return "''";
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
