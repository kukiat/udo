"use client";

import {
  parseDate,
  parseDateTime,
  type DateValue,
} from "@internationalized/date";
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
  type DatePickerProps as AriaDatePickerProps,
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

function toDateTimeValue(value?: string | null): DateValue | null {
  if (!value) return null;
  try {
    return parseDateTime(value);
  } catch {
    return null;
  }
}

type CommonDatePickerProps = Omit<
  AriaDatePickerProps<DateValue>,
  "children" | "className"
> & {
  label?: string;
  className?: string;
  variant?: "dark" | "light";
};

function CommonDatePicker({
  label,
  className,
  variant = "dark",
  ...props
}: CommonDatePickerProps) {
  const isLight = variant === "light";

  return (
    <AriaDatePicker
      {...props}
      className={cn(
        "flex flex-col gap-1.5",
        props.isDisabled && "opacity-60",
        className,
      )}
    >
      {label && (
        <Label
          className={cn(
            isLight ? "text-[13px] font-semibold text-ink" : "label",
          )}
        >
          {label}
        </Label>
      )}
      <Group
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm outline-none transition-colors",
          isLight
            ? "border-line bg-white text-ink focus-within:border-ink"
            : "border-[var(--border)] bg-[oklch(0.12_0.012_270)] text-[var(--text)] focus-within:border-[var(--coral)] focus-within:shadow-[0_0_0_3px_oklch(0.45_0.12_28/0.3)]",
        )}
      >
        <DateInput
          className={cn(
            "flex flex-1 font-mono text-sm",
            !isLight && "tracking-tight",
          )}
        >
          {(segment) => (
            <DateSegment
              segment={segment}
              className={cn(
                "rounded px-0.5 tabular-nums caret-transparent outline-none",
                isLight
                  ? "data-[placeholder]:text-ink-muted data-[focused]:bg-ink data-[focused]:text-white"
                  : "data-[placeholder]:text-[var(--text-3)] data-[focused]:bg-[var(--coral)] data-[focused]:text-[oklch(0.18_0.05_28)]",
              )}
            />
          )}
        </DateInput>
        <Button
          className={cn(
            "rounded-md px-1.5 outline-none transition-colors disabled:cursor-not-allowed",
            isLight
              ? "text-ink-muted hover:text-ink focus-visible:text-ink"
              : "text-[var(--text-2)] hover:text-[var(--text)] focus-visible:text-[var(--coral)]",
          )}
          aria-label="Open calendar"
        >
          v
        </Button>
      </Group>
      <Popover
        className={cn(
          "rounded-xl border p-4 shadow-xl entering:animate-in entering:fade-in",
          isLight
            ? "border-line bg-white"
            : "border-[oklch(0.34_0.025_270)] bg-[oklch(0.16_0.018_270)]",
        )}
        offset={6}
      >
        <Dialog className="outline-none">
          <Calendar
            className={cn(
              "flex flex-col gap-3",
              isLight ? "text-ink" : "text-[oklch(0.92_0.01_90)]",
            )}
          >
            <header className="flex items-center justify-between gap-2">
              <Button
                slot="previous"
                aria-label="Previous month"
                className={cn(
                  "rounded-lg px-2 py-1 outline-none transition-colors",
                  isLight
                    ? "text-ink-muted hover:bg-sand focus-visible:bg-sand"
                    : "text-[oklch(0.78_0.01_270)] hover:bg-[oklch(0.22_0.02_270)] focus-visible:bg-[oklch(0.22_0.02_270)]",
                )}
              >
                &lt;
              </Button>
              <Heading className="text-sm font-semibold" />
              <Button
                slot="next"
                aria-label="Next month"
                className={cn(
                  "rounded-lg px-2 py-1 outline-none transition-colors",
                  isLight
                    ? "text-ink-muted hover:bg-sand focus-visible:bg-sand"
                    : "text-[oklch(0.78_0.01_270)] hover:bg-[oklch(0.22_0.02_270)] focus-visible:bg-[oklch(0.22_0.02_270)]",
                )}
              >
                &gt;
              </Button>
            </header>
            <CalendarGrid className="border-separate [border-spacing:2px]">
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell
                    className={cn(
                      "text-[10px] font-semibold uppercase",
                      isLight
                        ? "text-ink-muted"
                        : "tracking-wider text-[oklch(0.6_0.01_270)]",
                    )}
                  >
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => (
                  <CalendarCell
                    date={date}
                    className={cn(
                      "h-9 w-9 cursor-pointer rounded-lg text-center text-sm tabular-nums outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-30 data-[focus-visible]:ring-2 data-[selected]:font-bold",
                      isLight
                        ? "data-[outside-month]:text-ink-muted data-[hovered]:bg-sand data-[focus-visible]:ring-ink data-[selected]:bg-ink data-[selected]:text-white"
                        : "data-[outside-month]:text-[oklch(0.4_0.01_270)] data-[hovered]:bg-[oklch(0.24_0.02_270)] data-[focus-visible]:ring-[var(--coral)] data-[selected]:bg-[var(--coral)] data-[selected]:text-[oklch(0.18_0.05_28)]",
                    )}
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
    <CommonDatePicker
      label={label}
      value={toDateValue(value)}
      onChange={(v) => v && onChange?.(v.toString())}
      minValue={toDateValue(min) ?? undefined}
      maxValue={toDateValue(max) ?? undefined}
      className={className}
    />
  );
}

export function DateTimePicker({
  label,
  value,
  onChange,
  isDisabled,
  className,
}: {
  label?: string;
  value?: string | null;
  onChange?: (value: string) => void;
  isDisabled?: boolean;
  className?: string;
}) {
  return (
    <CommonDatePicker
      label={label}
      value={toDateTimeValue(value)}
      onChange={(v) => v && onChange?.(v.toString().slice(0, 16))}
      granularity="minute"
      isDisabled={isDisabled}
      className={className}
      variant="light"
    />
  );
}
