import { handleError } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export async function POST() {
  try {
    await destroySession();
    return Response.json({ ok: true });
  } catch (err) {
    return handleError(err, "POST /api/auth/logout");
  }
}
