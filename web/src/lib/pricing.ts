// Claude Opus 4.8 standard pricing, USD per token (Resume Studio uses claude-opus-4-8).
// Verified 2026-07-12 from Anthropic pricing docs: $5 / M input, $25 / M output.
export const OPUS_IN_PER_TOK = 5 / 1_000_000;
export const OPUS_OUT_PER_TOK = 25 / 1_000_000;

/** Estimated USD cost from tracked token counts. Studio doesn't use prompt caching,
 *  so this tracks actual billing (excludes any future cache/batch pricing). */
export function estCostUSD(tokensIn: number, tokensOut: number): number {
  return tokensIn * OPUS_IN_PER_TOK + tokensOut * OPUS_OUT_PER_TOK;
}

export function formatUSD(n: number): string {
  if (n > 0 && n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}
