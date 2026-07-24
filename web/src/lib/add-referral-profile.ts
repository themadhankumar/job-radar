import { STUDIO_MODEL_SHARED } from "@/lib/studio";

export type ParsedExperience = {
  companyName: string;
  role: string;
  isCurrent: boolean;
  startDate: string;
  endDate: string;
};

export type ParsedProfile = {
  name: string;
  experiences: ParsedExperience[];
};

const clean = (s: unknown) => String(s ?? "").trim();

/** Extract a name + work history from pasted LinkedIn profile text via Haiku. */
export async function parseProfileText(apiKey: string, text: string): Promise<ParsedProfile> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: STUDIO_MODEL_SHARED,
      max_tokens: 1000,
      messages: [{
        role: "user",
        content:
          `This is text copied from a LinkedIn profile. Extract the person's name and their work ` +
          `history (Experience section) as JSON. For each role, mark isCurrent true only for their ` +
          `present employer (usually "Present" as the end date or no end date given).\n\n` +
          `Respond with ONLY a JSON object of this shape:\n` +
          `{"name": "...", "experiences": [{"companyName": "...", "role": "...", "isCurrent": true, "startDate": "...", "endDate": "..."}]}\n` +
          `Use "" for any field you can't find. Omit entries that aren't real employers.\n\n---\n${text.slice(0, 20_000)}`,
      }],
    }),
  });
  if (!res.ok) return { name: "", experiences: [] };
  const data = await res.json().catch(() => null);
  const responseText: string = data?.content?.find?.((b: { type?: string }) => b.type === "text")?.text ?? "";
  try {
    const j = JSON.parse(responseText.replace(/```json|```/g, "").trim());
    const experiences = Array.isArray(j.experiences)
      ? j.experiences.map((e: Record<string, unknown>) => ({
          companyName: clean(e.companyName).slice(0, 100),
          role: clean(e.role).slice(0, 100),
          isCurrent: Boolean(e.isCurrent),
          startDate: clean(e.startDate).slice(0, 40),
          endDate: clean(e.endDate).slice(0, 40),
        })).filter((e: ParsedExperience) => e.companyName)
      : [];
    return { name: clean(j.name).slice(0, 100), experiences };
  } catch {
    return { name: "", experiences: [] };
  }
}
