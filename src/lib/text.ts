export function matches(text: string, keyword: string, mode: "word" | "substring"): boolean {
  const t = text.toLowerCase();
  const k = keyword.toLowerCase();
  if (mode === "word") {
    return new RegExp(`\\b${escapeRegex(k)}\\b`).test(t);
  }
  return t.includes(k);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
