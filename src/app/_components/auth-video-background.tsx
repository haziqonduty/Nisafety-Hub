"use client";

import { useEffect, useState } from "react";

const VIDEO_SRC = "/auth-drone-bg.mp4";
const POSTER_SRC = "/auth-drone-bg.jpg";

/**
 * Looping aerial/drone footage behind the sign-in and sign-up forms. Starts
 * in the static-poster branch (so server and first client render match, and
 * so prefers-reduced-motion never even mounts a <video>), then switches to
 * the real video once we've confirmed motion is allowed.
 */
export function AuthVideoBackground() {
  const [allowMotion, setAllowMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- same pattern as theme-toggle.tsx: can't know this until mounted on the client.
    setAllowMotion(!query.matches);
    const onChange = () => setAllowMotion(!query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    // Not -z-10: <main> never establishes its own stacking context (plain
    // position: relative, no z-index/transform/opacity of its own), so a
    // negative z-index here would paint this behind <main>'s own background
    // fill instead of just behind its z-10 foreground content — invisible
    // either way. z-0 sits above the parent's background and below the
    // foreground content's explicit z-10, which is the actual goal.
    <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden bg-slate-950">
      {allowMotion ? (
        <video autoPlay muted loop playsInline preload="auto" poster={POSTER_SRC} className="absolute inset-0 h-full w-full object-cover">
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
      ) : (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${POSTER_SRC})` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/25 to-slate-950/70" />
    </div>
  );
}
