export type ClassValue = string | number | null | false | undefined | ClassValue[];

/** Tiny className joiner (no external dep). */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (Array.isArray(v)) out.push(cn(...v));
    else out.push(String(v));
  }
  return out.join(" ");
}
