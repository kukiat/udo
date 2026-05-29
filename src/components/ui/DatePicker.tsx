"use client";

import { parseDate, type DateValue } from "@internationalized/date";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePicker as AriaDatePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Label,
  Popover,
} from "react-aria-components";

import { cn } from "@/lib/cn";

function toDateValue(iso?: string | null): DateValue | null {
  if (!iso) return null;
  try {
    return parseDate(iso);
  } catch {
    return null;
  }
}

export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  className,
}: {
  label?: string;
  value?: string | null;
  onChange?: (iso: string) => void;
  min?: string;
  max?: string;
  className?: string;
}) {
  return (
    <AriaDatePicker
      value={toDateValue(value)}
      onChange={(v) => v && onChange?.(v.toString())}
      minValue={toDateValue(min) ?? undefined}
      maxValue={toDateValue(max) ?? undefined}
      className={cn("flex flex-col", className)}
    >
      {label && <Label className="label">{label}</Label>}
      <Group
        className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[oklch(0.12_0.012_270)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus-within:border-[var(--coral)] focus-within:shadow-[0_0_0_3px_oklch(0.45_0.12_28/0.3)]"
      >
        <DateInput className="flex flex-1 font-mono text-sm tracking-tight">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="rounded px-0.5 tabular-nums caret-transparent outline-none data-[placeholder]:text-[var(--text-3)] data-[focused]:bg-[var(--coral)] data-[focused]:text-[oklch(0.18_0.05_28)]"
            />
          )}
        </DateInput>
        <Button
          className="rounded-md px-1.5 text-[var(--text-2)] outline-none hover:text-[var(--text)] focus-visible:text-[var(--coral)]"
          aria-label="Open calendar"
        >
          📅
        </Button>
      </Group>
      <Popover
        className="rounded-2xl border border-[oklch(0.34_0.025_270)] bg-[oklch(0.16_0.018_270)] p-4 shadow-xl entering:animate-in entering:fade-in"
        offset={6}
      >
        <Dialog className="outline-none">
          <Calendar className="flex flex-col gap-3 text-[oklch(0.92_0.01_90)]">
            <header className="flex items-center justify-between gap-2">
              <Button
                slot="previous"
                className="rounded-lg px-2 py-1 text-[oklch(0.78_0.01_270)] outline-none hover:bg-[oklch(0.22_0.02_270)] focus-visible:bg-[oklch(0.22_0.02_270)]"
              >
                ‹
              </Button>
              <Heading className="text-sm font-semibold" />
              <Button
                slot="next"
                className="rounded-lg px-2 py-1 text-[oklch(0.78_0.01_270)] outline-none hover:bg-[oklch(0.22_0.02_270)] focus-visible:bg-[oklch(0.22_0.02_270)]"
              >
                ›
              </Button>
            </header>
            <CalendarGrid className="border-separate [border-spacing:2px]">
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className="text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.6_0.01_270)]">
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => (
                  <CalendarCell
                    date={date}
                    className="h-9 w-9 cursor-pointer rounded-lg text-center text-sm tabular-nums outline-none data-[outside-month]:text-[oklch(0.4_0.01_270)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-30 data-[hovered]:bg-[oklch(0.24_0.02_270)] data-[focus-visible]:ring-2 data-[focus-visible]:ring-[var(--coral)] data-[selected]:bg-[var(--coral)] data-[selected]:font-bold data-[selected]:text-[oklch(0.18_0.05_28)]"
                  />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </Calendar>
        </Dialog>
      </Popover>
    </AriaDatePicker>
  );
}
