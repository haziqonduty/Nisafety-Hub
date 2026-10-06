"use client";

import { useRef, type MouseEvent, type ReactNode } from "react";

type SpotlightCardProps = {
  as?: "div" | "li" | "article";
  className?: string;
  children: ReactNode;
};

export function SpotlightCard({ as = "div", className = "", children }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement | HTMLLIElement | HTMLElement>(null);

  function handleMove(event: MouseEvent<HTMLElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  }

  const Tag = as;
  return (
    // @ts-expect-error — ref type is a safe union across the few tags this component renders as
    <Tag ref={ref} onMouseMove={handleMove} className={`spotlight ${className}`}>
      {children}
    </Tag>
  );
}
