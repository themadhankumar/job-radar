import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Fixed-window rate limit backed by Postgres (serverless has no shared memory).
 * Returns true if the attempt is allowed. One round trip: upsert that resets
 * the window when it has elapsed, otherwise increments, and returns the count.
 * Fails open on DB errors — auth availability beats strictness.
 */
export async function rateLimit(key: string, limit: number, windowSecs: number): Promise<boolean> {
  try {
    const rows = await db.execute(sql`
      INSERT INTO auth_attempts (key, count, window_start)
      VALUES (${key}, 1, now())
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN auth_attempts.window_start < now() - make_interval(secs => ${windowSecs})
                     THEN 1 ELSE auth_attempts.count + 1 END,
        window_start = CASE WHEN auth_attempts.window_start < now() - make_interval(secs => ${windowSecs})
                            THEN now() ELSE auth_attempts.window_start END
      RETURNING count
    `);
    const count = Number((rows as unknown as { rows: { count: number }[] }).rows?.[0]?.count ?? 0);
    return count <= limit;
  } catch {
    return true;
  }
}

/** Best-effort client IP behind Vercel's proxy. */
export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
}

export const RATE_LIMITED = { error: "Too many attempts — try again in a few minutes." };
