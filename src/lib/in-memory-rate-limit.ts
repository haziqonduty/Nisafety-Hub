// Zero-setup fallback rate limiter — no migration, no external service.
// Lives in module scope, so it persists across requests on a warm Vercel
// function instance (confirmed Fluid Compute is enabled for this project,
// which keeps instances warm more often than classic per-request cold
// starts) but resets on a cold start and isn't shared across concurrent
// instances. That's a real, accepted limitation — this is deliberately a
// defense-in-depth layer, not a replacement for the DB-backed checkRateLimit
// in rate-limit.ts, which is durable across instances but needs its table's
// migration applied to actually do anything.
const attemptsByKey = new Map<string, number[]>();

export function checkInMemoryRateLimit(key: string, windowMinutes: number, maxAttempts: number) {
  const now = Date.now();
  const windowMs = windowMinutes * 60 * 1000;
  const recent = (attemptsByKey.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

  if (recent.length >= maxAttempts) {
    attemptsByKey.set(key, recent);
    return { limited: true as const };
  }

  recent.push(now);
  attemptsByKey.set(key, recent);
  return { limited: false as const };
}
