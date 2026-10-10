import { timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { createAdminSession } from "@/lib/auth/session";
import { clientIpFrom } from "@/lib/request-ip";
import { checkRateLimit } from "@/lib/supabase/rate-limit";

const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_ATTEMPTS = 5;

function safeCompare(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export async function POST(request: Request) {
  const ipAddress = clientIpFrom(request);
  const { limited } = await checkRateLimit(
    "admin_login_attempts",
    ipAddress,
    RATE_LIMIT_WINDOW_MINUTES,
    RATE_LIMIT_MAX_ATTEMPTS,
  );

  if (limited) {
    return Response.json({ error: "Too many sign-in attempts. Try again in a few minutes." }, { status: 429 });
  }

  const { username, password } = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  const expectedUsername = process.env.ADMIN_USERNAME;
  const expectedPasswordHash = process.env.ADMIN_PASSWORD_HASH;

  if (!expectedUsername || !expectedPasswordHash) {
    return Response.json({ error: "Admin sign-in is not configured." }, { status: 500 });
  }

  const isValid =
    typeof username === "string" &&
    typeof password === "string" &&
    safeCompare(username, expectedUsername) &&
    (await bcrypt.compare(password, expectedPasswordHash));

  if (!isValid) {
    return Response.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  await createAdminSession();
  return Response.json({ ok: true });
}
