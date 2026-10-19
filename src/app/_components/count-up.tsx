"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 900;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

// Animates from whatever was last displayed to the new value — so it
// counts up from 0 on first mount, but also handles a later value change
// (e.g. a live Realtime update) by ticking from the old number rather than
// resetting to 0 first.
export function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    const delta = value - from;
    if (delta === 0) return;

    // requestAnimationFrame isn't a CSS animation/transition, so the app's
    // global prefers-reduced-motion rule (which zeroes those durations)
    // doesn't cover it — checked explicitly here instead. Routed through
    // the same rAF-driven tick rather than a synchronous setState call, so
    // the reduced-motion case still resolves in a single (instant) frame.
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = prefersReducedMotion ? 0 : DURATION_MS;

    let frame: number;
    const start = performance.now();

    function tick(now: number) {
      const progress = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      setDisplay(Math.round(from + easeOutCubic(progress) * delta));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}
