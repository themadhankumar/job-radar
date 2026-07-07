import Link from "next/link";
import { redirect } from "next/navigation";
import { Radar, Building2, Settings } from "lucide-react";
import { Logo } from "@/components/logo";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton, ThemeToggle } from "@/components/shell-actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");

  const nav = [
    { href: "/radar", label: "Radar", icon: Radar },
    { href: "/companies", label: "Companies", icon: Building2 },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="surface fixed inset-y-0 hidden w-56 flex-col border-y-0 border-l-0 p-4 sm:flex">
        <div className="mb-8 px-2"><Logo /></div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium t-muted hover:bg-[rgb(var(--border))]/40 hover:text-[rgb(var(--text))]">
              <Icon size={16} /> {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between px-2">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <div className="flex items-center gap-1"><ThemeToggle /><LogoutButton /></div>
        </div>
      </aside>
      <nav className="surface fixed inset-x-0 bottom-0 z-20 flex justify-around border-x-0 border-b-0 py-2 sm:hidden">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-0.5 px-4 py-1 text-xs t-muted">
            <Icon size={18} /> {label}
          </Link>
        ))}
      </nav>
      <main className="w-full pb-20 sm:pb-0 sm:pl-56">{children}</main>
    </div>
  );
}
