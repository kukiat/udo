import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";

import { db, schema } from "@/db";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export { SESSION_COOKIE };
const SESSION_TTL_DAYS = 7;

export type UserRole =
  | "owner"
  | "admin"
  | "branch_manager"
  | "cashier"
  | "kitchen_staff"
  | "waitstaff";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  restaurantId: string;
  branchId: string | null;
};

// Which roles may access each area of the app. Owner/admin can reach everything.
export const AREA_ROLES: Record<string, UserRole[]> = {
  dashboard: ["owner", "admin", "branch_manager"],
  pos: ["owner", "admin", "cashier"],
  kds: ["owner", "admin", "branch_manager", "kitchen_staff"],
  reports: ["owner", "admin", "branch_manager"],
  waitstaff: ["owner", "admin", "branch_manager", "waitstaff"],
};

export function canAccess(area: keyof typeof AREA_ROLES, role: UserRole): boolean {
  return AREA_ROLES[area]?.includes(role) ?? false;
}

/** Create a DB session row and set the httpOnly cookie. */
export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
  const [session] = await db
    .insert(schema.sessions)
    .values({ userId, expiresAt })
    .returning({ id: schema.sessions.id });

  const store = await cookies();
  store.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return session.id;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, token));
  }
  store.delete(SESSION_COOKIE);
}

/** Resolve the current user from the session cookie, or null if unauthenticated. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.query.sessions.findFirst({
    where: and(
      eq(schema.sessions.id, token),
      gt(schema.sessions.expiresAt, new Date()),
    ),
    with: { user: true },
  });
  if (!session) return null;

  const u = session.user;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as UserRole,
    restaurantId: u.restaurantId,
    branchId: u.branchId,
  };
}
