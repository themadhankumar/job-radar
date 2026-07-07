"use client";
import { useRouter } from "next/navigation";
import { LogOut, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      aria-label="Sign out"
      className="rounded-md p-1.5 t-muted hover:bg-[rgb(var(--border))]/40"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut size={15} />
    </button>
  );
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  return (
    <button
      aria-label="Toggle theme"
      className="rounded-md p-1.5 t-muted hover:bg-[rgb(var(--border))]/40"
      onClick={() => {
        const next = !dark;
        setDark(next);
        document.documentElement.classList.toggle("dark", next);
        localStorage.theme = next ? "dark" : "light";
      }}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
