"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { BarChart, ShieldCheck, Trash, Users } from "@/app/_components/icons";

const TABS = [
  { href: "/admin", label: "Clients", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart },
  { href: "/admin/staff", label: "Staff", icon: ShieldCheck },
  { href: "/admin/recycle-bin", label: "Recycle bin", icon: Trash },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const activeRef = useRef<HTMLAnchorElement>(null);

  // On phones the tabs scroll sideways; keep the current one in view.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <nav className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1 [scrollbar-width:none]">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            ref={isActive ? activeRef : undefined}
            href={tab.href}
            aria-current={isActive}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
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
