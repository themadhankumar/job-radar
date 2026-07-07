/**
 * ATS boards (Greenhouse especially) return descriptions as HTML-escaped HTML,
 * sometimes double-escaped (&amp;amp;). Decode entities, strip tags, decode
 * again for inner entities, and collapse whitespace into readable text.
 */

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "'",
  lsquo: "'",
  rdquo: "\u201d",
  ldquo: "\u201c",
  hellip: "…",
  bull: "•",
  middot: "·",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeChar(parseInt(d, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED[name] ?? m);
}

function safeChar(code: number): string {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
}

export function htmlToText(input: string | null | undefined): string {
  if (!input) return "";
  let s = decodeEntities(input);          // unwrap escaping → real HTML
  s = s
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*>/gi, "\n")
    .replace(/<li[\s>]/gi, "\n• <")
    .replace(/<[^>]+>/g, " ");            // strip tags
  s = decodeEntities(s);                  // inner entities (&amp;amp; case)
  return s.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}
