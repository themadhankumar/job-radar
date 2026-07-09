import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { COOLDOWN_MIN, cooldownRemainingSec, latestRun } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Latest pipeline run + cooldown state, for the Refresh button to poll. */
export async function GET() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  try {
    const run = await latestRun();
    if (run === "unconfigured") return NextResponse.json({ configured: false });
    return NextResponse.json({
      configured: true,
      cooldownMin: COOLDOWN_MIN,
      cooldownRemainingSec: cooldownRemainingSec(run),
      run,
    });
  } catch {
    return NextResponse.json({ error: "Could not reach GitHub" }, { status: 502 });
  }
}
