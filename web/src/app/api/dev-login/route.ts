// TEMPORARY local debugging route — never commit. Guarded to dev only.
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({}, { status: 404 });
  const uid = Number(new URL(req.url).searchParams.get("uid") ?? 1);
  await createSession(uid);
  return NextResponse.redirect(new URL("/radar?tab=global", req.url));
}
