import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { errorResponse, parseBody, serverError } from "@/lib/api";
import { createSession, type AuthUser, type UserRole } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { makeTimer } from "@/lib/utils";
import { loginSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, loginSchema);
    if (error) return error;

    const timed = makeTimer(`auth-login POST ${crypto.randomUUID().slice(0, 8)}`);

    const user = await timed("select user", () =>
      db.query.users.findFirst({
        where: eq(schema.users.email, data.email.toLowerCase()),
      }),
    );

    // Always run a verify to keep timing roughly constant for unknown emails.
    const ok = user
      ? await verifyPassword(data.password, user.passwordHash)
      : await verifyPassword(data.password, "scrypt$00$00");

    if (!user || !ok) {
      return errorResponse(
        "INVALID_CREDENTIALS",
        "Invalid email or password",
        401,
      );
    }

    await timed("create session", () => createSession(user.id));

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      restaurantId: user.restaurantId,
      branchId: user.branchId,
    };
    return Response.json({ user: authUser });
  } catch (err) {
    console.error("POST /api/auth/login", err);
    return serverError();
  }
}
