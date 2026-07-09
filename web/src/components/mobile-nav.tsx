"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Radar, Building2, Target, FileText, UserRound, Settings, MoreHorizontal } from "lucide-react";

const PRIMARY = [
  { href: "/radar", label: "Radar", icon: Radar },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/roles", label: "Roles", icon: Target },
] as const;

const MORE = [
  { href: "/resume", label: "Resume", icon: FileText },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]); // close sheet on navigation
  const moreActive = MORE.some((m) => pathname.startsWith(m.href));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-20 sm:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="surface absolute inset-x-0 bottom-14 rounded-t-xl border-x-0 border-b-0 p-2"
            onClick={(e) => e.stopPropagation()}>
            {MORE.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className={`flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium ${pathname.startsWith(href) ? "t-accent" : "t-muted"}`}>
                <Icon size={16} /> {label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <nav className="surface fixed inset-x-0 bottom-0 z-20 flex justify-around border-x-0 border-b-0 py-2 sm:hidden">
        {PRIMARY.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs ${pathname.startsWith(href) ? "t-accent" : "t-muted"}`}>
            <Icon size={18} /> {label}
          </Link>
        ))}
        <button onClick={() => setOpen((o) => !o)} aria-label="More pages"
          className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs ${open || moreActive ? "t-accent" : "t-muted"}`}>
          <MoreHorizontal size={18} /> More
        </button>
      </nav>
    </>
  );
}
