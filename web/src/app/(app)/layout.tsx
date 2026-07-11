import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton, ThemeToggle } from "@/components/shell-actions";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarNav } from "@/components/sidebar-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");


  return (
    <div className="flex min-h-screen">
      <aside className="surface fixed inset-y-0 hidden w-56 flex-col border-y-0 border-l-0 p-4 sm:flex">
        <div className="mb-8 px-2"><Logo /></div>
        <SidebarNav />
        <div className="flex items-center justify-between px-2">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <div className="flex items-center gap-1"><ThemeToggle /><LogoutButton /></div>
        </div>
      </aside>
      <MobileNav />
      <main className="w-full px-4 pb-20 pt-6 sm:px-8 sm:pb-8 sm:pt-8 sm:pl-56">{children}</main>
    </div>
  );
}
