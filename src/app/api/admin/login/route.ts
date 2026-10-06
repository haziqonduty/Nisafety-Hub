import { timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { createAdminSession } from "@/lib/auth/session";

function safeCompare(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

export async function POST(request: Request) {
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
