"use client";

import { cn } from "@/lib/cn";

/**
 * Shared − / value / + quantity control used across the order flow.
 * Surfaces read the theme CSS variables (instead of the light-only Tailwind
 * colors like bg-sand/bg-white) so the control renders as a grey chip on the
 * dark order theme and keeps the warm neutral look on light surfaces.
 */
export function QuantityStepper({
  value,
  onDecrease,
  onIncrease,
  shape = "pill",
  decreaseLabel = "Decrease",
  increaseLabel = "Increase",
  className,
}: {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
  /** "pill" = fully rounded (item modal footer) · "rounded" = card-style (cart rows) */
  shape?: "pill" | "rounded";
  decreaseLabel?: string;
  increaseLabel?: string;
  className?: string;
}) {
  const pill = shape === "pill";
  const btn =
    "grid h-9 w-9 place-items-center text-[16px] leading-none text-ink transition-colors hover:bg-[var(--line-strong)]";
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center border border-line bg-[var(--line)]",
        pill ? "rounded-full p-0.5" : "rounded-lg",
        className,
      )}
    >
      <button
        type="button"
        onClick={onDecrease}
        aria-label={decreaseLabel}
        className={cn(btn, pill ? "rounded-full" : "rounded-l-lg")}
      >
        −
      </button>
      <span className="min-w-7 text-center text-[14px] font-semibold tabular-nums text-ink">
        {value}
      </span>
      <button
        type="button"
        onClick={onIncrease}
        aria-label={increaseLabel}
        className={cn(btn, pill ? "rounded-full" : "rounded-r-lg")}
      >
        +
      </button>
    </div>
  );
}
