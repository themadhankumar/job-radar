// Visual tier thresholds for match-score signal strength (glow / dim / mute).
// Recalibrated 2026-07-10 against the real post-rescore distribution
// (20k MAX_JOBS cap, all-last-45-days corpus): p99=49, p97=43, p95=40, p90=34, p85=31, p80=29.
// With the old 70/50 split, only ~1% of jobs cleared "mid" at all — everything read muted.
//
// HI marks true standouts (~top 4%); MID covers the Suggested-worthy range (Suggested
// threshold defaults to 35, so MID's floor sits below it — nothing in Suggested should
// ever render fully muted). Keep pipeline/digest.py's SCORE_TIER_* constants in sync
// if these change.
export const SCORE_TIER_HI = 42;
export const SCORE_TIER_MID = 30;

export type ScoreTier = "score-hi" | "score-mid" | "score-low";

export function getScoreTier(score: number): ScoreTier {
  if (score >= SCORE_TIER_HI) return "score-hi";
  if (score >= SCORE_TIER_MID) return "score-mid";
  return "score-low";
}
