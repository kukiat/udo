import { redirect } from "next/navigation";

import { AREA_ROLES, canAccess, getCurrentUser, type AuthUser } from "@/lib/auth";

/**
 * Server-side route guard. Redirects to /login when unauthenticated and to
 * /forbidden when the user's role can't reach the area. Returns the user.
 */
export async function requireAccess(
  area: keyof typeof AREA_ROLES,
  redirectTo?: string,
): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : "";
    redirect(`/login${next}`);
  }
  if (!canAccess(area, user.role)) redirect("/forbidden");
  return user;
}
