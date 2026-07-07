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
