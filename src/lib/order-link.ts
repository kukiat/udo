"use client";

import { useSearchParams } from "next/navigation";

/**
 * The order pages are gated by `?s=<sessionId>` only, so every internal link
 * must carry the param forward. Returns a builder that appends the current `s`
 * to any order-page path.
 */
export function useOrderLink() {
  const params = useSearchParams();
  const s = params.get("s");
  return (path: string) => {
    if (!s) return path;
    const sep = path.includes("?") ? "&" : "?";
    return `${path}${sep}s=${encodeURIComponent(s)}`;
  };
}
