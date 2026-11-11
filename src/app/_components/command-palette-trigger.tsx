"use client";

import type { ReactNode } from "react";

// The command palette is mounted once in the locale layout, outside this
// component's tree, so it's opened via the same window event the directory
// search bar's "⌘ K" hint already uses (see directory-explorer.tsx).
export function CommandPaletteTrigger({ className = "", children, ariaLabel }: { className?: string; children: ReactNode; ariaLabel?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event("open-command-palette"))} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
