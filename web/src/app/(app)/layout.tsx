import { redirect } from "next/navigation";

import { Logo } from "@/components/logo";
import { getSessionUser } from "@/lib/auth";
import { LogoutButton, ThemeToggle } from "@/components/shell-actions";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { FeedbackWidget } from "@/components/feedback-widget";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");


  return (
    <div className="flex min-h-screen">
      <aside className="surface fixed inset-y-0 hidden w-60 flex-col border-y-0 border-l-0 p-5 sm:flex">
        <div className="mb-10 px-2"><Logo /></div>
        <SidebarNav />
        <div className="flex items-center justify-between px-2">
          <span className="truncate text-sm font-medium">{user.name}</span>
          <div className="flex items-center gap-1"><ThemeToggle /><LogoutButton /></div>
        </div>
      </aside>
      <MobileNav />
      <main className="w-full px-5 pb-24 pt-8 sm:px-10 sm:pb-12 sm:pt-12 sm:pl-60">{children}</main>
      <FeedbackWidget loggedIn />
    </div>
  );
}
