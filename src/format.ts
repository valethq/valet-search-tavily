import type { Hit } from "./types";

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}...` : s);
const squash = (s: string) => s.replace(/\n{3,}/g, "\n\n").trim();

export function formatHits(hits: Hit[], max: number): string {
  if (hits.length === 0) return "No results.";
  return hits
    .map((h, i) => {
      const meta = [h.date?.slice(0, 10), h.author].filter(Boolean).join(" · ");
      const text = h.text ? clip(squash(h.text), max) : "";
      return [`[${i + 1}] ${h.title || h.url}`, h.url, meta, text].filter(Boolean).join("\n");
    })
    .join("\n\n");
}
