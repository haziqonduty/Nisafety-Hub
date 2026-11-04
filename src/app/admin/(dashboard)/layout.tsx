import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/profile";
import { LogoutButton } from "@/app/_components/logout-button";
import { AdminNav } from "@/app/_components/admin-nav";
import { BrandLogo } from "@/app/_components/brand-logo";
import { ThemeToggle } from "@/app/_components/theme-toggle";

export default async function AdminDashboardLayout({ children }: LayoutProps<"/admin">) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.status !== "approved") redirect("/pending-approval");
  if (profile.role !== "admin") redirect("/");

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 lg:px-8">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <span className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink-muted">Admin</span>
        </div>
        <AdminNav />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 lg:px-8">{children}</main>
    </div>
  );
}
