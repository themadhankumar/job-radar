"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "./logo";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/auth/${mode}`, {
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
    const { onboarded } = await res.json();
    router.push(onboarded ? "/radar" : "/onboarding");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="surface w-full max-w-sm rounded-xl p-8">
        <div className="mb-6 flex justify-center text-lg"><Logo /></div>
        <h1 className="mb-1 text-center text-xl font-semibold">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="t-muted mb-6 text-center text-sm">
          {mode === "login" ? "Sign in to your radar" : "Start tracking the roles that matter"}
        </p>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input name="name" required placeholder="Your name" className="input" autoComplete="name" />
          )}
          <input name="email" type="email" required placeholder="Email" className="input" autoComplete="email" />
          <input
            name="password" type="password" required minLength={8}
            placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"}
            className="input" autoComplete={mode === "signup" ? "new-password" : "current-password"}
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button disabled={loading} className="btn-primary w-full">
            {loading ? "One moment…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="t-muted mt-4 text-center text-sm">
          {mode === "login" ? (
            <>New here? <Link href="/signup" className="t-accent hover:underline">Create an account</Link></>
          ) : (
            <>Already have an account? <Link href="/login" className="t-accent hover:underline">Sign in</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
