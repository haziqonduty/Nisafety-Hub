"use client";

import { useEffect, useState } from "react";

// Renders nothing until mounted — the server can't know the viewer's
// timezone, so there's no sensible SSR value and an empty slot avoids a
// hydration mismatch. Ticks once a minute (seconds would just be noise).
export function LiveClock({ locale, className = "" }: { locale: string; className?: string }) {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat(locale === "ms" ? "ms-MY" : "en-GB", { hour: "2-digit", minute: "2-digit" });
    const update = () => setTime(formatter.format(new Date()));
    update();
    // Align the first tick to the next whole minute so the display never lags.
    const msToNextMinute = 60_000 - (Date.now() % 60_000);
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      update();
      interval = setInterval(update, 60_000);
    }, msToNextMinute);
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [locale]);

  return (
    <span className={`tabular-nums ${className}`} aria-live="off">
      {time ?? "  :  "}
    </span>
  );
}
