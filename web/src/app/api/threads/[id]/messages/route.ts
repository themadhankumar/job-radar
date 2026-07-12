import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { getSessionUser } from "@/lib/auth";
import {
  GAP_ANALYSIS_PROMPT,
  checkCap,
  recordUsage,
  resolveKey,
  screenerPackPrompt,
  streamAnthropic,
  studioModel,
  studioSystemPrompt,
  type ChatMsg,
} from "@/lib/studio";

export const runtime = "nodejs";
export const maxDuration = 300;

const sse = (data: object) => `data: ${JSON.stringify(data)}\n\n`;

/**
 * Append a turn to a Studio thread and stream the assistant reply as SSE.
 * Body: { content: string } for a normal turn, or { bootstrap: true } to run
 * the automatic gap analysis as the thread's first message.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const threadId = Number(params.id);
  if (!Number.isInteger(threadId)) return NextResponse.json({ error: "Bad thread." }, { status: 400 });

  const [thread] = await db
    .select()
    .from(schema.resumeThreads)
    .where(and(eq(schema.resumeThreads.id, threadId), eq(schema.resumeThreads.userId, user.id)));
  if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const bootstrap = body.bootstrap === true;
  const screener = body.screener === true;
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!bootstrap && !screener && (!content || content.length > 8000)) {
    return NextResponse.json({ error: "Message must be 1–8000 characters." }, { status: 400 });
  }

  const { key, byok } = resolveKey(user);
  if (!key) return NextResponse.json({ error: "No API key available — add yours in Settings." }, { status: 503 });
  const capError = await checkCap(user.id, byok);
  if (capError) return NextResponse.json({ error: capError }, { status: 429 });

  const [job] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, thread.jobId));
  const [resume] = await db.select().from(schema.resumes).where(eq(schema.resumes.userId, user.id));
  if (!job || !resume) return NextResponse.json({ error: "Missing job or resume." }, { status: 400 });

  const history = await db
    .select({ role: schema.resumeMessages.role, content: schema.resumeMessages.content })
    .from(schema.resumeMessages)
    .where(eq(schema.resumeMessages.threadId, threadId))
    .orderBy(asc(schema.resumeMessages.createdAt), asc(schema.resumeMessages.id));

  if (bootstrap && history.length > 0) {
    return NextResponse.json({ error: "Thread already started." }, { status: 409 });
  }

  const userTurn = bootstrap ? GAP_ANALYSIS_PROMPT : screener ? screenerPackPrompt(user.needsSponsorship) : content;
  const messages: ChatMsg[] = [
    ...history.map((m) => ({ role: m.role, content: m.content }) as ChatMsg),
    { role: "user", content: userTurn },
  ];
  const system = studioSystemPrompt(job, resume.content);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(encoder.encode(sse(data)));
      let acc = "";
      try {
        const result = await streamAnthropic({
          apiKey: key,
          model: studioModel(byok),
          system,
          messages,
          maxTokens: 2000,
          onDelta: (chunk) => {
            acc += chunk;
            send({ type: "delta", text: chunk });
          },
        });
        // Persist the user turn (hidden label for bootstrap) and the reply, then usage.
        await db.insert(schema.resumeMessages).values([
          { threadId, role: "user", content: bootstrap ? "__gap_analysis__" : screener ? "__screener_pack__" : userTurn, tokensIn: 0, tokensOut: 0 },
          { threadId, role: "assistant", content: result.text, tokensIn: result.tokensIn, tokensOut: result.tokensOut },
        ]);
        await recordUsage(user.id, result.tokensIn, result.tokensOut);
        send({ type: "done", tokensIn: result.tokensIn, tokensOut: result.tokensOut });
      } catch (err) {
        // Keep whatever streamed so the thread doesn't lose context on reopen.
        if (acc.length > 0) {
          const estOut = Math.ceil(acc.length / 4);
          await db
            .insert(schema.resumeMessages)
            .values([
              { threadId, role: "user", content: bootstrap ? "__gap_analysis__" : screener ? "__screener_pack__" : userTurn, tokensIn: 0, tokensOut: 0 },
              { threadId, role: "assistant", content: acc + "\n\n_[reply was cut off — ask me to continue]_", tokensIn: 0, tokensOut: estOut },
            ])
            .catch(() => {});
          await recordUsage(user.id, 0, estOut).catch(() => {});
        }
        send({ type: "error", message: byok
          ? "The reply was interrupted — your key may have been rejected, or the request failed. What streamed so far is saved."
          : "The reply was interrupted — what streamed so far is saved. Ask me to continue." });
        console.error("studio stream:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
