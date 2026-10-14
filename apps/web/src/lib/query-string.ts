/** Drops empty values and stringifies the rest (for typed GET queries). */
export function toQuery(params: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  return out as never;
}
