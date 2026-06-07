"use client";

import type { ButtonProps } from "react-aria-components";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type PillButtonTone = "neutral" | "accent" | "danger" | "success";
type PillButtonVariant = "solid" | "outline";

// Pill button matching the dashboard's "Edit restaurant" look.
// Uses CSS vars so the surface, border, and ink colors swap automatically
// between the KDS light and dark themes.
const PILL_BTN_COMMON =
  "!h-[34px] !rounded-md !border !px-3.5 !text-[13px] !font-medium";

const SOLID: Record<PillButtonTone, string> = {
  neutral:
    "!border-[color:var(--line-strong)] !bg-[color:var(--bg-elev)] !text-[color:var(--ink)] hover:!bg-[color:var(--bg-sunken)]",
  accent:
    "!border-clay-500 !bg-clay-500 !text-white shadow-[0_8px_18px_-14px_rgba(217,84,43,0.8)] hover:!border-clay-600 hover:!bg-clay-600 hover:shadow-[0_10px_24px_-14px_rgba(217,84,43,0.9)] pressed:!border-clay-700 pressed:!bg-clay-700 pressed:shadow-[0_6px_14px_-12px_rgba(217,84,43,0.75)]",
  danger:
    "!border-rose !bg-rose !text-white shadow-[0_8px_18px_-14px_rgba(184,58,58,0.8)] hover:!border-rose/90 hover:!bg-rose/90 hover:shadow-[0_10px_24px_-14px_rgba(184,58,58,0.9)] pressed:!border-rose/80 pressed:!bg-rose/80 pressed:shadow-[0_6px_14px_-12px_rgba(184,58,58,0.75)]",
  success:
    "!border-olive !bg-olive !text-white shadow-[0_8px_18px_-14px_rgba(42,111,78,0.8)] hover:!border-olive/90 hover:!bg-olive/90 hover:shadow-[0_10px_24px_-14px_rgba(42,111,78,0.9)] pressed:!border-olive/80 pressed:!bg-olive/80 pressed:shadow-[0_6px_14px_-12px_rgba(42,111,78,0.75)]",
};

const OUTLINE: Record<PillButtonTone, string> = {
  neutral:
    "!border-[color:var(--line-strong)] !bg-transparent !text-[color:var(--ink)] hover:!border-[color:var(--ink)] hover:!bg-[color:var(--bg-sunken)]",
  accent:
    "!border-clay-500 !bg-transparent !text-clay-500 hover:!bg-clay-500/10 pressed:!bg-clay-500/20",
  danger:
    "!border-rose !bg-transparent !text-rose hover:!bg-rose/10 pressed:!bg-rose/20",
  success:
    "!border-olive !bg-transparent !text-olive hover:!bg-olive/10 pressed:!bg-olive/20",
};

const styles: Record<PillButtonVariant, Record<PillButtonTone, string>> = {
  solid: SOLID,
  outline: OUTLINE,
};

export function PillButton({
  className,
  tone = "neutral",
  variant = "solid",
  ...props
}: ButtonProps & {
  className?: string;
  tone?: PillButtonTone;
  variant?: PillButtonVariant;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      {...props}
      className={cn(PILL_BTN_COMMON, styles[variant][tone], className)}
    />
  );
}
