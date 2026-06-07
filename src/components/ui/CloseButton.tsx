"use client";

import { cn } from "@/lib/cn";

export function CloseButton({
  onPress,
  className,
  label = "Close",
  size = 18,
}: {
  onPress: () => void;
  className?: string;
  /** Accessible label / tooltip text. Defaults to "Close". */
  label?: string;
  /** Icon size in px. */
  size?: number;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onPress}
      style={{ color: "var(--ink-3)" }}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-zinc-500/15",
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}
