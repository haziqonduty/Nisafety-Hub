import { deleteAdminSession } from "@/lib/auth/session";

export async function POST() {
  await deleteAdminSession();
  return Response.json({ ok: true });
}
