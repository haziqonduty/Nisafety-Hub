/**
 * Where to send someone after an email link is verified. "next" comes from
 * the URL, so only same-site paths are allowed: otherwise a genuine reset
 * link could be edited to send the person to any outside website (an open
 * redirect).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/reset-password") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
