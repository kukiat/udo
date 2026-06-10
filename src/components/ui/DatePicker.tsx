"use client";

import { useContext } from "react";

import {
  getLocalTimeZone,
  now,
  parseDate,
  parseDateTime,
  toCalendarDateTime,
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
  DatePickerStateContext,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Label,
  Popover,
  type DatePickerProps as AriaDatePickerProps,
} from "react-aria-components";

import { ChevronDown } from "lucide-react";

import { TimeColumn } from "@/components/ui/TimePicker";
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
  /** Show hour/minute columns next to the calendar (datetime picking). */
  withTime?: boolean;
};

function CommonDatePicker({
  label,
  className,
  variant = "dark",
  withTime = false,
  ...props
}: CommonDatePickerProps) {
  const isLight = variant === "light";

  return (
    <AriaDatePicker
      {...props}
      shouldCloseOnSelect={!withTime}
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
          "inline-flex h-10 items-center gap-1.5 rounded-lg border px-2.5 text-sm outline-none transition-colors",
          isLight
            ? "border-line bg-white text-ink focus-within:border-ink"
            : "border-[var(--border)] bg-[oklch(0.12_0.012_270)] text-[var(--text)] focus-within:border-[var(--coral)] focus-within:shadow-[0_0_0_3px_oklch(0.45_0.12_28/0.3)]",
        )}
      >
        <DateInput
          className={cn(
            "flex min-w-0 flex-1 font-mono text-sm",
            !isLight && "tracking-tight",
          )}
        >
          {(segment) => (
            <DateSegment
              segment={segment}
              className={cn(
                "rounded px-px tabular-nums caret-transparent outline-none",
                isLight
                  ? "data-[placeholder]:text-[var(--ink-3)] data-[focused]:bg-[var(--accent)] data-[focused]:text-[var(--accent-ink)]"
                  : "data-[placeholder]:text-[var(--text-3)] data-[focused]:bg-[var(--coral)] data-[focused]:text-[oklch(0.18_0.05_28)]",
              )}
            />
          )}
        </DateInput>
        <Button
          className={cn(
            "shrink-0 rounded-md p-0.5 outline-none transition-colors disabled:cursor-not-allowed",
            isLight
              ? "text-ink-muted hover:text-ink focus-visible:text-ink"
              : "text-[var(--text-2)] hover:text-[var(--text)] focus-visible:text-[var(--coral)]",
          )}
          aria-label="Open calendar"
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
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
        <Dialog
          aria-label={withTime ? "Select date and time" : "Select date"}
          className="outline-none"
        >
          {({ close }) => (
            <div className="flex flex-col gap-3">
              <div className={cn("flex items-start", withTime && "gap-3")}>
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
                            "flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-sm tabular-nums outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-30 data-[focus-visible]:ring-2 data-[selected]:font-bold",
                            isLight
                              ? // CSS variables (not Tailwind palette classes) so the kds-dark
                                // remaps apply inside data-[...] variants too.
                                "data-[outside-month]:text-[var(--ink-3)] data-[hovered]:bg-[var(--accent-soft)] data-[focus-visible]:ring-[var(--accent)] data-[selected]:bg-[var(--accent)] data-[selected]:text-[var(--accent-ink)]"
                              : "data-[outside-month]:text-[oklch(0.4_0.01_270)] data-[hovered]:bg-[oklch(0.24_0.02_270)] data-[focus-visible]:ring-[var(--coral)] data-[selected]:bg-[var(--coral)] data-[selected]:text-[oklch(0.18_0.05_28)]",
                          )}
                        />
                      )}
                    </CalendarGridBody>
                  </CalendarGrid>
                </Calendar>
                {withTime && (
                  <>
                    <div
                      className={cn(
                        "w-px self-stretch",
                        isLight ? "bg-line" : "bg-[oklch(0.34_0.025_270)]",
                      )}
                    />
                    <TimePanel />
                  </>
                )}
              </div>
              {withTime && (
                <div
                  className={cn(
                    "flex justify-end border-t pt-3",
                    isLight ? "border-line" : "border-[oklch(0.34_0.025_270)]",
                  )}
                >
                  <Button
                    onPress={close}
                    className={cn(
                      "rounded-lg px-4 py-1.5 text-[13px] font-semibold outline-none transition-colors",
                      isLight
                        ? "bg-ink text-white hover:bg-ink/90 data-[focus-visible]:ring-2 data-[focus-visible]:ring-ink/40"
                        : "bg-[var(--coral)] text-[oklch(0.18_0.05_28)] data-[focus-visible]:ring-2",
                    )}
                  >
                    Done
                  </Button>
                </div>
              )}
            </div>
          )}
        </Dialog>
      </Popover>
    </AriaDatePicker>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

// Hour/minute columns shown next to the calendar. Reads/writes the picker's
// value through the DatePicker state context so date and time stay in sync.
function TimePanel() {
  const state = useContext(DatePickerStateContext);
  const value = state?.value ?? null;
  const selHour = value && "hour" in value ? value.hour : null;
  const selMinute = value && "minute" in value ? value.minute : null;

  const setPart = (part: "hour" | "minute", n: number) => {
    if (!state) return;
    const base =
      value && "hour" in value
        ? value
        : toCalendarDateTime(now(getLocalTimeZone()));
    state.setValue(
      part === "hour" ? base.set({ hour: n }) : base.set({ minute: n }),
    );
  };

  return (
    <div className="flex" style={{ height: 280 }}>
      <TimeColumn
        heading="Hour"
        values={HOURS}
        selected={selHour}
        open
        onSelect={(n) => setPart("hour", n)}
      />
      <div className="w-px self-stretch bg-line" />
      <TimeColumn
        heading="Min"
        values={MINUTES}
        selected={selMinute}
        open
        onSelect={(n) => setPart("minute", n)}
      />
    </div>
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
      withTime
    />
  );
}
