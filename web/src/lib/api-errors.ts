import { NextResponse } from "next/server";

/**
 * Turn a thrown auth/DB error into a response the operator can act on.
 * The full error always goes to the server log; the client gets a category.
 */
export function authErrorResponse(e: unknown, context: string) {
  console.error(`[${context}]`, e);
  const code = (e as NodeJS.ErrnoException)?.code ?? "";
  const raw = `${e instanceof Error ? e.message : String(e)} ${code}`;
  if (/unique|duplicate key/i.test(raw)) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|ECONNRESET|SSL|SASL|password authentication|pg_hba|does not exist|Connection terminated/i.test(raw)) {
    return NextResponse.json(
      { error: "Can't reach the database. If you're running locally, check DATABASE_URL in web/.env." },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { error: "Unexpected server error — details are in the server logs." },
    { status: 500 },
  );
}
