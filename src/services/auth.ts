import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { createSession, type AuthUser, type UserRole } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { makeTimer } from "@/lib/utils";
import type { LoginInput } from "@/lib/validation";
import { ServiceError } from "@/services/errors";

export class AuthService {
  /**
   * Verify credentials and start a session. Always runs a password verify (even
   * for unknown emails) to keep timing roughly constant. Throws
   * INVALID_CREDENTIALS on any mismatch; on success the session cookie is set.
   */
  async login(input: LoginInput): Promise<AuthUser> {
    const timed = makeTimer(`auth-login POST ${crypto.randomUUID().slice(0, 8)}`);

    const user = await timed("select user", () =>
      db.query.users.findFirst({
        where: eq(schema.users.email, input.email.toLowerCase()),
      }),
    );

    const ok = user
      ? await verifyPassword(input.password, user.passwordHash)
      : await verifyPassword(input.password, "scrypt$00$00");

    if (!user || !ok) {
      throw new ServiceError("INVALID_CREDENTIALS", "Invalid email or password", 401);
    }

    await timed("create session", () => createSession(user.id));

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      restaurantId: user.restaurantId,
      branchId: user.branchId,
    };
  }
}

export const authService = new AuthService();
