"use client";

/**
 * Fire-and-forget client analytics. Never throws, never blocks the UI, and
 * survives navigation via sendBeacon when available. The server derives the
 * user from the session cookie, so we only send name + props.
 */
export function track(name: string, props: Record<string, unknown> = {}): void {
  try {
    const body = JSON.stringify({ name, props });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* analytics must never break the app */
  }
}
