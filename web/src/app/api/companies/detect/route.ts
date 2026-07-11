import { NextResponse } from "next/server";
import { detectAts } from "@/lib/ats";
import { getSessionUserId } from "@/lib/auth";

export async function POST(req: Request) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const { name } = await req.json().catch(() => ({}));
  if (!name || typeof name !== "string" || name.length > 80) {
    return NextResponse.json({ error: "Enter a company name." }, { status: 400 });
  }
  const hit = await detectAts(name.trim());
  return NextResponse.json({ hit });
}
