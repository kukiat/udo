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
}: {
  label?: string;
  options: SelectOption[];
  selectedKey?: string | null;
  onSelectionChange?: (key: string | null) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <AriaSelect
      selectedKey={selectedKey ?? null}
      onSelectionChange={(k) => onSelectionChange?.(k === null ? null : String(k))}
      className={cn("flex flex-col gap-1.5", className)}
    >
      {label && (
        <Label className="text-sm font-medium text-ink-soft">{label}</Label>
      )}
      <Button className="inline-flex items-center justify-between rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100">
        <SelectValue className="data-[placeholder]:text-ink-muted">
          {({ defaultChildren, isPlaceholder }) =>
            isPlaceholder ? placeholder : defaultChildren}
        </SelectValue>
        <span aria-hidden className="text-ink-muted ml-2">
          ▾
        </span>
      </Button>
      <Popover className="w-[--trigger-width] rounded-xl border border-line bg-white shadow-card overflow-auto entering:animate-in entering:fade-in">
        <ListBox className="p-1 outline-none">
          {options.map((o) => (
            <ListBoxItem
              key={o.id}
              id={o.id}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm text-ink outline-none selected:bg-clay-50 selected:text-clay-700 focus:bg-sand"
            >
              {o.label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
  );
}
