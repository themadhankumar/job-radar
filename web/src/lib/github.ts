// GitHub Actions bridge for the "Refresh now" button.
// Requires GH_DISPATCH_TOKEN — a fine-grained PAT scoped to this repo with
// Actions: read+write. Without it the feature reports itself unconfigured.

const REPO = process.env.GH_REPO ?? "themadhankumar/job-radar";
const WORKFLOW = "pipeline.yml";
const API = "https://api.github.com";

/** Global cooldown between pipeline runs, shared across all users. */
export const COOLDOWN_MIN = 30;

function ghHeaders(): Record<string, string> | null {
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) return null;
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export type RunInfo = {
  status: string; // queued | in_progress | completed
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  event: string;
};

/** Most recent run of the pipeline workflow (any trigger), or null if none. */
export async function latestRun(): Promise<RunInfo | null | "unconfigured"> {
  const headers = ghHeaders();
  if (!headers) return "unconfigured";
  const res = await fetch(`${API}/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GitHub runs API returned ${res.status}`);
  const data = await res.json();
  const run = data.workflow_runs?.[0];
  if (!run) return null;
  return {
    status: run.status,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    event: run.event,
  };
}

/** Fire a workflow_dispatch on main. GitHub returns 204 with no run id. */
export async function dispatchRun(): Promise<void> {
  const headers = ghHeaders();
  if (!headers) throw new Error("GH_DISPATCH_TOKEN not configured");
  const res = await fetch(`${API}/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ ref: "main" }),
    cache: "no-store",
  });
  if (res.status !== 204) throw new Error(`GitHub dispatch API returned ${res.status}`);
}

/** Seconds until the global cooldown clears, based on the latest run's start. */
export function cooldownRemainingSec(run: RunInfo | null): number {
  if (!run) return 0;
  const elapsedSec = (Date.now() - new Date(run.createdAt).getTime()) / 1000;
  return Math.max(0, Math.round(COOLDOWN_MIN * 60 - elapsedSec));
}
