"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";

export function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Try again.");
      return;
    }
    const { onboarded } = await res.json();
    router.push(onboarded ? "/radar" : "/onboarding");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="surface w-full max-w-sm rounded-xl p-8">
        <div className="mb-6 flex justify-center text-lg"><Logo /></div>
        <h1 className="mb-1 text-center text-xl font-semibold">Choose a new password</h1>
        <p className="t-muted mb-6 text-center text-sm">You'll be signed in right after</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            name="password" type="password" required minLength={8}
            placeholder="New password (8+ characters)" className="input" autoComplete="new-password"
          />
          <input
            name="confirm" type="password" required minLength={8}
            placeholder="Confirm new password" className="input" autoComplete="new-password"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button disabled={loading} className="btn-primary w-full">
            {loading ? "One moment…" : "Set new password"}
          </button>
        </form>
        <p className="t-muted mt-4 text-center text-sm">
          Link expired? <Link href="/forgot" className="t-accent hover:underline">Request a new one</Link>
        </p>
      </div>
    </div>
  );
}
