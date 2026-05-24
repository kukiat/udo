import { getCurrentUser } from "@/lib/auth";
import { serverError } from "@/lib/api";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return Response.json({ user });
  } catch (err) {
    console.error("GET /api/auth/me", err);
    return serverError();
  }
}
