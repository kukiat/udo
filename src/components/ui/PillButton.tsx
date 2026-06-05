"use client";

import type { ButtonProps } from "react-aria-components";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

// Pill-outline button matching the dashboard's "Edit restaurant" look.
// Uses CSS vars so the surface, border, and ink colors swap automatically
// between the KDS light and dark themes.
const PILL_BTN =
  "!h-[34px] !rounded-md !border !border-[color:var(--line-strong)] !bg-[color:var(--bg-elev)] !text-[color:var(--ink)] !px-3.5 !text-[13px] !font-medium hover:!bg-[color:var(--bg-sunken)]";

export function PillButton({
  className,
  ...props
}: ButtonProps & { className?: string }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      {...props}
      className={cn(PILL_BTN, className)}
    />
  );
}
