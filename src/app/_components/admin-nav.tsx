"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { BarChart, Users } from "@/app/_components/icons";

const TABS = [
  { href: "/admin", label: "Clients", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              isActive ? "bg-brand text-white" : "text-ink-muted hover:text-accent"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
