"use client";

import { Button as AriaButton, type ButtonProps } from "react-aria-components";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-clay-500 text-white hover:bg-clay-600 pressed:bg-clay-700 border border-transparent",
  secondary:
    "bg-white text-ink hover:bg-sand border border-line pressed:bg-sand",
  ghost: "bg-transparent text-ink hover:bg-sand border border-transparent",
  danger:
    "bg-white text-red-600 border border-red-200 hover:bg-red-50 pressed:bg-red-100",
};

const sizes: Record<Size, string> = {
  sm: "text-sm px-3 py-1.5 rounded-lg",
  md: "text-sm px-4 py-2 rounded-xl",
  lg: "text-base px-5 py-3 rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps & { variant?: Variant; size?: Size; className?: string }) {
  return (
    <AriaButton
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-clay-300 focus-visible:ring-offset-1",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
    />
  );
}
