import { htmlToText } from "@/lib/text";

/* ---------------------------------------------------------------- types */

export type ParsedJob = {
  title: string;
  companyName: string;
  location: string;
  description: string;
  url: string;
  postedAt: Date | null;
};

export type AddUrlResult =
  | { kind: "parsed"; job: ParsedJob }
  | { kind: "needs-paste"; reason: string };

/* ------------------------------------------------------- URL classifiers */

/** Domains we never try to scrape — bot walls or JS-only rendering. */
const HOSTILE = [
  "linkedin.com",
  "myworkdayjobs.com",
  "myworkdaysite.com",
  "workday.com",
  "indeed.com",
  "glassdoor.com",
  "ziprecruiter.com",
];

export function isHostile(url: URL): boolean {
  return HOSTILE.some((d) => url.hostname === d || url.hostname.endsWith("." + d));
}

async function probe(url: string): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 (compatible; JobRadar/1.0)" },
    });
    clearTimeout(t);
    return res;
  } catch {
    return null;
  }
}

const clean = (s: unknown) => String(s ?? "").trim();
const toDate = (v: unknown): Date | null => {
  const d = new Date(String(v ?? ""));
  return isNaN(d.getTime()) ? null : d;
};

/* --------------------------------------------- ATS single-posting fetchers */

/** boards.greenhouse.io/{slug}/jobs/{id} or job-boards.greenhouse.io/... */
async function fromGreenhouse(u: URL): Promise<ParsedJob | null> {
  const m = u.pathname.match(/^\/([^/]+)\/jobs\/(\d+)/);
  if (!m) return null;
  const [, slug, id] = m;
  const res = await probe(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs/${id}`);
  const j = res?.ok ? await res.json().catch(() => null) : null;
  if (!j?.title) return null;
  return {
    title: clean(j.title),
    companyName: clean(j.company_name) || slug,
    location: clean(j.location?.name),
    description: htmlToText(clean(j.content)),
    url: clean(j.absolute_url) || u.href,
    postedAt: toDate(j.first_published ?? j.updated_at),
  };
}

/** jobs.lever.co/{slug}/{uuid} */
async function fromLever(u: URL): Promise<ParsedJob | null> {
  const m = u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/i);
  if (!m) return null;
  const [, slug, id] = m;
  const res = await probe(`https://api.lever.co/v0/postings/${slug}/${id}`);
  const j = res?.ok ? await res.json().catch(() => null) : null;
  if (!j?.text) return null;
  return {
    title: clean(j.text),
    companyName: slug,
    location: clean(j.categories?.location),
    description: clean(j.descriptionPlain) || htmlToText(clean(j.description)),
    url: clean(j.hostedUrl) || u.href,
    postedAt: toDate(j.createdAt),
  };
}

/** jobs.ashbyhq.com/{slug}/{uuid} — no single-posting endpoint; scan the board. */
async function fromAshby(u: URL): Promise<ParsedJob | null> {
  const m = u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{36})/i);
  if (!m) return null;
  const [, slug, id] = m;
  const res = await probe(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`);
  const data = res?.ok ? await res.json().catch(() => null) : null;
  const j = data?.jobs?.find?.((x: { id?: string }) => String(x.id) === id);
  if (!j?.title) return null;
  return {
    title: clean(j.title),
    companyName: slug,
    location: clean(j.location),
    description: htmlToText(clean(j.descriptionHtml)) || clean(j.descriptionPlain),
    url: clean(j.jobUrl ?? j.applyUrl) || u.href,
    postedAt: toDate(j.publishedAt ?? j.publishedDate),
  };
}

/* ------------------------------------------------------------ generic page */

async function fromGenericPage(u: URL): Promise<ParsedJob | null> {
  const res = await probe(u.href);
  if (!res?.ok) return null;
  const html = await res.text().catch(() => "");
  const text = htmlToText(html);
  if (text.length < 200) return null; // JS-rendered shell or a wall — not a real JD
  // Title/company come from Haiku later; carry the raw text through.
  return {
    title: "",
    companyName: "",
    location: "",
    description: text.slice(0, 30_000),
    url: u.href,
    postedAt: null,
  };
}

/* ----------------------------------------------------------------- entry */

export async function parseJobUrl(rawUrl: string): Promise<AddUrlResult> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return { kind: "needs-paste", reason: "That doesn't look like a valid URL." };
  }
  if (!/^https?:$/.test(u.protocol)) {
    return { kind: "needs-paste", reason: "Only http(s) links are supported." };
  }
  if (isHostile(u)) {
    return { kind: "needs-paste", reason: "This site blocks readers — paste the job description instead." };
  }

  const host = u.hostname;
  let job: ParsedJob | null = null;
  if (host.endsWith("greenhouse.io")) job = await fromGreenhouse(u);
  else if (host.endsWith("lever.co")) job = await fromLever(u);
  else if (host.endsWith("ashbyhq.com")) job = await fromAshby(u);
  else job = await fromGenericPage(u);

  return job
    ? { kind: "parsed", job }
    : { kind: "needs-paste", reason: "Couldn't read a job description from that page — paste it instead." };
}

/* --------------------------------------------- Haiku title/company backfill */

const EXTRACT_MODEL = "claude-haiku-4-5";

/** Fill title/company/location from JD text when the source didn't provide them. */
export async function extractJobMeta(
  apiKey: string,
  description: string,
  urlHint: string,
): Promise<{ title: string; companyName: string; location: string }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: EXTRACT_MODEL,
      max_tokens: 300,
      messages: [{
        role: "user",
        content:
          `From this job posting, extract the job title, company name, and location. ` +
          `Posting URL (may hint at the company): ${urlHint}\n\n` +
          `Respond with ONLY a JSON object: {"title": "...", "companyName": "...", "location": "..."} ` +
          `Use "" for anything you can't find.\n\n---\n${description.slice(0, 12_000)}`,
      }],
    }),
  });
  if (!res.ok) return { title: "", companyName: "", location: "" };
  const data = await res.json().catch(() => null);
  const text: string = data?.content?.find?.((b: { type?: string }) => b.type === "text")?.text ?? "";
  try {
    const j = JSON.parse(text.replace(/```json|```/g, "").trim());
    return {
      title: clean(j.title).slice(0, 200),
      companyName: clean(j.companyName).slice(0, 120),
      location: clean(j.location).slice(0, 120),
    };
  } catch {
    return { title: "", companyName: "", location: "" };
  }
}
