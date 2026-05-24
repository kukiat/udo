import { destroySession } from "@/lib/auth";
import { serverError } from "@/lib/api";

export async function POST() {
  try {
    await destroySession();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("POST /api/auth/logout", err);
    return serverError();
  }
}
