export type AtsHit = { ats: "greenhouse" | "lever" | "ashby"; slug: string };

function slugVariants(name: string): string[] {
  const base = name.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const out = [base.replace(/ /g, ""), base.replace(/ /g, "-"), base.split(" ")[0]];
  return [...new Set(out.filter(Boolean))];
}

async function probe(url: string, init?: RequestInit): Promise<Response | null> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    clearTimeout(t);
    return res;
  } catch {
    return null;
  }
}

export async function detectAts(name: string): Promise<AtsHit | null> {
  for (const slug of slugVariants(name)) {
    const gh = await probe(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`);
    if (gh?.ok) {
      const data = await gh.json().catch(() => null);
      if (data && "jobs" in data) return { ats: "greenhouse", slug };
    }
    const lv = await probe(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    if (lv?.ok) {
      const data = await lv.json().catch(() => null);
      if (Array.isArray(data)) return { ats: "lever", slug };
    }
    const ab = await probe(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
    if (ab?.ok) {
      const data = await ab.json().catch(() => null);
      if (data && "jobs" in data) return { ats: "ashby", slug };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ fetch */

export type FetchedPosting = {
  extId: string;
  title: string;
  url: string;
  location: string;
  description: string;
  postedAt: Date | null;
};

const toDate = (v: unknown): Date | null => {
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/**
 * Fetch every posting from a Greenhouse / Lever / Ashby board.
 * Used for the instant fetch when a company is added; the Python pipeline
 * remains the source of truth on its schedule.
 */
export async function fetchBoard(
  ats: string,
  slug: string,
  cap = 400,
): Promise<FetchedPosting[]> {
  if (ats === "greenhouse") {
    const res = await probe(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (!data?.jobs) return [];
    return (data.jobs as any[]).slice(0, cap).map((j) => ({
      extId: String(j.id),
      title: String(j.title ?? "").trim(),
      url: String(j.absolute_url ?? ""),
      location: String(j.location?.name ?? ""),
      description: String(j.content ?? ""),
      postedAt: toDate(j.first_published ?? j.updated_at),
    }));
  }
  if (ats === "lever") {
    const res = await probe(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (!Array.isArray(data)) return [];
    return (data as any[]).slice(0, cap).map((j) => ({
      extId: String(j.id),
      title: String(j.text ?? "").trim(),
      url: String(j.hostedUrl ?? ""),
      location: String(j.categories?.location ?? ""),
      description: String(j.descriptionPlain ?? j.description ?? ""),
      postedAt: toDate(j.createdAt),
    }));
  }
  if (ats === "ashby") {
    const res = await probe(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (!data?.jobs) return [];
    return (data.jobs as any[]).slice(0, cap).map((j) => ({
      extId: String(j.id),
      title: String(j.title ?? "").trim(),
      url: String(j.jobUrl ?? j.applyUrl ?? ""),
      location: String(j.location ?? ""),
      description: String(j.descriptionHtml ?? j.descriptionPlain ?? ""),
      postedAt: toDate(j.publishedAt ?? j.publishedDate),
    }));
  }
  return [];
}
