import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { cooldownRemainingSec, dispatchRun, latestRun } from "@/lib/github";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Trigger a pipeline run via workflow_dispatch.
 * Any signed-in user may trigger; a single global cooldown (COOLDOWN_MIN,
 * measured from the latest run of ANY trigger — manual or scheduled) gates it.
 */
export async function POST() {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  try {
    const run = await latestRun();
    if (run === "unconfigured")
      return NextResponse.json({ error: "Refresh isn't set up yet (missing GH_DISPATCH_TOKEN)" }, { status: 501 });
    if (run && run.status !== "completed")
      return NextResponse.json({ error: "A refresh is already running" }, { status: 409 });
    const remaining = cooldownRemainingSec(run);
    if (remaining > 0)
      return NextResponse.json(
        { error: "Cooldown active", cooldownRemainingSec: remaining },
        { status: 429 },
      );
    await dispatchRun();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not reach GitHub" }, { status: 502 });
  }
}
