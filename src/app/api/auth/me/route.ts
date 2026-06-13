import { handleError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return Response.json({ user });
  } catch (err) {
    return handleError(err, "GET /api/auth/me");
  }
}
