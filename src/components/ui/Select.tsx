"use client";

import {
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select as AriaSelect,
  SelectValue,
} from "react-aria-components";

import { cn } from "@/lib/cn";

export type SelectOption = { id: string; label: string };

export function Select({
  label,
  options,
  selectedKey,
  onSelectionChange,
  placeholder = "Select…",
  className,
  dark = false,
}: {
  label?: string;
  options: SelectOption[];
  selectedKey?: string | null;
  onSelectionChange?: (key: string | null) => void;
  placeholder?: string;
  className?: string;
  /** Neon Diner dark variant (for the dashboard). The popover portals outside
   *  the .dir-a scope, so colors are spelled out explicitly here. */
  dark?: boolean;
}) {
  // The dropdown popover/listbox render in a portal (outside any `.dir-a`
  // wrapper), so the dark variant uses explicit oklch values rather than
  // CSS variables that wouldn't cascade through the portal.
  const labelClass = dark
    ? "text-[11px] font-semibold uppercase tracking-[0.08em] text-[oklch(0.6_0.01_270)]"
    : "text-sm font-medium text-ink-soft";
  const buttonClass = dark
    ? "inline-flex items-center justify-between rounded-md border border-[oklch(0.34_0.025_270)] bg-[oklch(0.12_0.012_270)] px-3.5 py-1.5 text-xs font-medium text-[oklch(0.97_0.005_90)] outline-none focus:border-[oklch(0.72_0.21_28)] focus:ring-[3px] focus:ring-[oklch(0.45_0.12_28/0.3)]"
    : "inline-flex items-center justify-between rounded-md border border-line bg-white px-3.5 py-1.5 text-xs font-medium text-ink outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100";
  const popoverClass = dark
    ? "w-[--trigger-width] rounded-md border border-[oklch(0.34_0.025_270)] bg-[oklch(0.21_0.02_270)] shadow-xl overflow-auto entering:animate-in entering:fade-in"
    : "w-[--trigger-width] rounded-md border border-line bg-white shadow-card overflow-auto entering:animate-in entering:fade-in";
  const itemClass = dark
    ? "cursor-pointer rounded-md px-2.5 py-1.5 text-[13px] text-[oklch(0.78_0.01_270)] outline-none selected:bg-[oklch(0.45_0.12_28)] selected:text-[oklch(0.97_0.005_90)] selected:font-semibold focus:bg-[oklch(0.28_0.022_270)]"
    : "cursor-pointer rounded-md px-2.5 py-1.5 text-[13px] text-ink outline-none selected:bg-clay-50 selected:text-clay-700 focus:bg-sand";

  return (
    <AriaSelect
      selectedKey={selectedKey ?? null}
      onSelectionChange={(k) => onSelectionChange?.(k === null ? null : String(k))}
      className={cn("flex flex-col gap-1.5", className)}
    >
      {label && <Label className={labelClass}>{label}</Label>}
      <Button className={buttonClass}>
        <SelectValue
          className={dark ? "data-[placeholder]:text-[oklch(0.6_0.01_270)]" : "data-[placeholder]:text-ink-muted"}
        >
          {({ defaultChildren, isPlaceholder }) =>
            isPlaceholder ? placeholder : defaultChildren}
        </SelectValue>
        <span aria-hidden className="ml-2 opacity-60">
          ▾
        </span>
      </Button>
      <Popover className={popoverClass}>
        <ListBox className="flex flex-col gap-[2px] p-1 outline-none">
          {options.map((o) => (
            <ListBoxItem key={o.id} id={o.id} className={itemClass}>
              {o.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
