"use client";

import { useRef, useState, type MouseEvent, type ReactNode } from "react";

const STRENGTH = 0.35;
const MAX_OFFSET = 14;

export function MagneticLink({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  function handleMove(event: MouseEvent<HTMLSpanElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (event.clientX - (rect.left + rect.width / 2)) * STRENGTH;
    const y = (event.clientY - (rect.top + rect.height / 2)) * STRENGTH;
    setOffset({ x: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, x)), y: Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, y)) });
  }

  function handleLeave() {
    setOffset({ x: 0, y: 0 });
  }

  return (
    <span
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="inline-block"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        transition: offset.x === 0 && offset.y === 0 ? "transform .45s cubic-bezier(.22,1,.36,1)" : "transform .12s ease-out",
      }}
    >
      {children}
    </span>
  );
}
