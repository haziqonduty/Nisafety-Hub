"use client";

import { useEffect, useState } from "react";

const VIDEO_SRC = "/auth-drone-bg.mp4";
const POSTER_SRC = "/auth-drone-bg.jpg";

/**
 * Looping aerial/drone footage behind the sign-in and sign-up forms. Starts
 * in the static-poster branch (so server and first client render match, and
 * so prefers-reduced-motion never even mounts a <video>), then switches to
 * the real video once we've confirmed motion is allowed.
 *
 * `paused`: this ~12.6MB file streams continuously at ~4.7Mbps for as long as
 * it's playing — on a weaker/congested connection that can queue a real
 * in-flight request (e.g. sign-in) behind it for many seconds (bufferbloat),
 * not just slow it proportionally. Calling video.pause() alone doesn't
 * reliably abort an already-in-flight network fetch for the stream, so
 * instead we fully unmount the <video> while `paused` is true — removing a
 * media element from the DOM is the one thing guaranteed to tear down its
 * network connection. Falls back to the poster image meanwhile.
 */
export function AuthVideoBackground({ paused = false }: { paused?: boolean }) {
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
      {allowMotion && !paused ? (
        // preload="metadata": this file is ~12.6MB — preload="auto" told the
        // browser to start pulling the whole thing down immediately on
        // mount, which is cosmetic and should never outrank a real request.
        <video autoPlay muted loop playsInline preload="metadata" poster={POSTER_SRC} className="absolute inset-0 h-full w-full object-cover">
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
      ) : (
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${POSTER_SRC})` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-slate-950/25 to-slate-950/70" />
    </div>
  );
}
