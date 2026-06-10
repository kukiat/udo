"use client";

import { useEffect } from "react";

const BRAND = "Udo";

/**
 * Sets the browser tab title from a client page (client components cannot
 * export Next.js `metadata`). Pass null/undefined to keep the current title
 * until the data the title depends on has loaded.
 */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    if (!title) return;
    const full = `${title} · ${BRAND}`;
    document.title = full;
    // Next.js streams the metadata <title> in after hydration, which would
    // overwrite the value set above — watch <head> and re-assert.
    const observer = new MutationObserver(() => {
      if (document.title !== full) document.title = full;
    });
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [title]);
}
