# Domain: Identity & Access

Who can sign in and what each role may reach. Cross-cutting: every protected
domain consumes this one; it depends on nothing else.

## Purpose

Authenticate staff users with cookie sessions and authorize them per app area
via a role map. Customers are *not* users — customer access is a capability
URL validated by Floor & Tables (`GET /api/sessions/access`).

## Owned data

| Table | Schema file | Notes |
|-------|-------------|-------|
| `users` | `src/db/schema/user.ts` | email, name, scrypt `passwordHash`, `role`, `restaurantId`, nullable `branchId` |
| `sessions` | `src/db/schema/session.ts` | row id doubles as the opaque cookie token; `expiresAt` (7-day TTL) |

Roles: `owner`, `admin`, `branch_manager`, `cashier`, `kitchen_staff`,
`waitstaff`.

## API surface

| Endpoint | Route file | Behavior |
|----------|-----------|----------|
| `POST /api/auth/login` | `src/app/api/auth/login/route.ts` | verify password, create session row, set `rms_session` httpOnly cookie |
| `POST /api/auth/logout` | `src/app/api/auth/logout/route.ts` | delete session row, clear cookie |
| `GET /api/auth/me` | `src/app/api/auth/me/route.ts` | current user or `null` |

## Key modules

- `src/lib/auth.ts` — `getCurrentUser`, `createSession`/`destroySession`,
  `AREA_ROLES` map, `canAccess(area, role)`
- `src/lib/guard.ts` — `requireAccess(area)` used by server layouts
- `src/lib/password.ts` — scrypt hash/verify
- `src/lib/session-cookie.ts` — cookie name constant
- `src/middleware.ts` — redirects unauthenticated requests off protected paths
  (cookie presence only; role checks happen server-side)
- `src/contexts/AuthContext.tsx` — client-side current user

## Business rules

- Area access map (`AREA_ROLES`): dashboard & reports → owner/admin/
  branch_manager · pos → owner/admin/cashier · kds → owner/admin/
  branch_manager/kitchen_staff · waitstaff → owner/admin/branch_manager/
  waitstaff.
- Session tokens are opaque DB ids — revocation is a row delete.
- Expired sessions are treated as absent (`expiresAt > now()` filter).

## Dependencies

- **Depends on:** nothing (foundation domain).
- **Depended on by:** every authenticated route (`getCurrentUser`,
  `requireAccess`); Billing attributes payments to `cashierId`; Floor &
  Tables records `reservedById`.
