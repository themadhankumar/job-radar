"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radar, Building2, Target, FileText, UserRound, Settings, Handshake } from "lucide-react";

const NAV = [
  { href: "/radar", label: "Radar", icon: Radar },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/referrals", label: "Referrals", icon: Handshake },
  { href: "/roles", label: "Roles", icon: Target },
  { href: "/resume", label: "Resume", icon: FileText },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              active
                ? "bg-[rgb(var(--accent)/0.10)] text-[rgb(var(--accent))]"
                : "t-muted hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
            }`}
          >
            <Icon size={16} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
