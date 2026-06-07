import { getCurrentUser } from "@/lib/auth";
import { serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";

export async function GET() {
  try {
    const timed = makeTimer(`auth-me GET ${crypto.randomUUID().slice(0, 8)}`);
    const user = await timed("get current user", () => getCurrentUser());
    return Response.json({ user });
  } catch (err) {
    console.error("GET /api/auth/me", err);
    return serverError();
  }
}
