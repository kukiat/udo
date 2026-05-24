// Kept in its own module (no db/next-headers imports) so the Edge middleware
// can import the cookie name without pulling in server-only dependencies.
export const SESSION_COOKIE = "rms_session";
