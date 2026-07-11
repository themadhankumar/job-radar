"use client";
import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";

export default function ForgotPage() {
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="surface w-full max-w-sm rounded-xl p-8">
        <div className="mb-6 flex justify-center text-lg"><Logo /></div>
        <h1 className="mb-1 text-center text-xl font-semibold">Reset your password</h1>
        <p className="t-muted mb-6 text-center text-sm">
          {sent ? "Check your inbox" : "We'll email you a reset link"}
        </p>
        {sent ? (
          <p className="text-center text-sm">
            If an account exists for that email, a reset link is on its way. The link expires in 1 hour.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input name="email" type="email" required placeholder="Email" className="input" autoComplete="email" />
            {error && <p className="text-sm text-[rgb(var(--danger))]">{error}</p>}
            <button disabled={loading} className="btn-primary w-full">
              {loading ? "One moment…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="t-muted mt-4 text-center text-sm">
          Remembered it? <Link href="/login" className="t-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
