"use client";

import { useEffect, useRef, useState } from "react";

import { parseTime } from "@internationalized/date";
import { ClockIcon } from "lucide-react";
import {
  Button,
  DateInput,
  DateSegment,
  Dialog,
  FieldError,
  Label,
  Popover,
  TimeField,
  type TimeValue,
} from "react-aria-components";

import { cn } from "@/lib/cn";

function toTimeValue(value?: string | null): TimeValue | null {
  if (!value) return null;
  try {
    return parseTime(value);
  } catch {
    return null;
  }
}

function formatTime(value: TimeValue) {
  const hour = String(value.hour).padStart(2, "0");
  const minute = String(value.minute).padStart(2, "0");
  return `${hour}:${minute}`;
}

const toMinutes = (v: TimeValue) => v.hour * 60 + v.minute;

// Dropdown choices. Hours cover the full day; minutes step by 5 (typical for
// store hours). Any exact minute can still be typed into the segmented field.
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

export function TimePicker({
  label,
  value,
  onChange,
  ariaLabel,
  width = "100%",
  height = 38,
  className,
  isDisabled,
  minTime,
  maxTime,
}: {
  label?: string;
  value?: string | null;
  onChange?: (value: string) => void;
  ariaLabel?: string;
  width?: number | string;
  height?: number;
  className?: string;
  isDisabled?: boolean;
  /** Earliest selectable time ("HH:MM"); earlier options are disabled. */
  minTime?: string | null;
  /** Latest selectable time ("HH:MM"); later options are disabled. */
  maxTime?: string | null;
}) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // The popover portals to <body>, escaping the modal's dark scope, so mirror
  // the nearest dark ancestor onto it whenever it opens.
  const [dark, setDark] = useState(false);

  const current = toTimeValue(value);
  const selHour = current?.hour ?? null;
  const selMinute = current?.minute ?? null;

  const minTV = toTimeValue(minTime);
  const maxTV = toTimeValue(maxTime);
  const minM = minTV ? toMinutes(minTV) : null;
  const maxM = maxTV ? toMinutes(maxTV) : null;
  const inRange = (m: number) =>
    (minM == null || m >= minM) && (maxM == null || m <= maxM);

  // Pull an out-of-range value back to the nearest bound so the field never
  // holds a time outside [minTime, maxTime].
  const clamp = (tv: TimeValue): TimeValue => {
    const m = toMinutes(tv);
    if (minTV && minM != null && m < minM) return minTV;
    if (maxTV && maxM != null && m > maxM) return maxTV;
    return tv;
  };

  const commit = (tv: TimeValue) => onChange?.(formatTime(clamp(tv)));

  const setPart = (part: "hour" | "minute", n: number) => {
    const base = current ?? parseTime("00:00");
    commit(part === "hour" ? base.set({ hour: n }) : base.set({ minute: n }));
  };

  const toggle = () => {
    setDark(
      !!triggerRef.current?.closest(
        ".kds-dark, .admin-dark, [data-theme='dark']",
      ),
    );
    setOpen((o) => !o);
  };

  // An hour is disabled only when none of its (5-min) options fall in range; a
  // minute is judged against whichever hour is currently selected.
  const hourDisabled = (h: number) => !MINUTES.some((m) => inRange(h * 60 + m));
  const minuteDisabled = (m: number) => !inRange((selHour ?? 0) * 60 + m);

  return (
    <TimeField
      value={current}
      onChange={(v) => v && commit(v)}
      granularity="minute"
      hourCycle={24}
      isDisabled={isDisabled}
      aria-label={ariaLabel}
      className={cn("flex flex-col gap-1.5", className)}
      style={{ width }}
    >
      {label && (
        <Label className="text-[13px] font-medium text-ink-soft">{label}</Label>
      )}
      <div
        ref={triggerRef}
        className={cn(
          "inline-flex items-center rounded-[10px] border border-line bg-[var(--bg-elev)] pl-3 pr-1 transition-colors",
          "focus-within:border-ink-soft",
          isDisabled && "opacity-60",
        )}
        style={{ height }}
      >
        <DateInput className="flex flex-1 items-center font-mono text-[13px] text-ink outline-none">
          {(segment) => (
            <DateSegment
              segment={segment}
              className={cn(
                "rounded px-0.5 tabular-nums caret-transparent outline-none",
                "data-[placeholder]:text-[var(--ink-3)] data-[focused]:bg-[var(--accent)] data-[focused]:text-[var(--accent-ink)]",
              )}
            />
          )}
        </DateInput>
        <Button
          aria-label="Open time picker"
          isDisabled={isDisabled}
          onPress={toggle}
          className={cn(
            "ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-muted outline-none transition-colors",
            "hover:bg-[var(--line)] hover:text-ink data-[pressed]:bg-[var(--line)]",
            "data-[focus-visible]:ring-2 data-[focus-visible]:ring-clay-500/40",
          )}
        >
          <ClockIcon className="h-4 w-4" />
        </Button>
      </div>

      <Popover
        triggerRef={triggerRef}
        isOpen={open}
        onOpenChange={setOpen}
        placement="bottom end"
        offset={6}
        className={cn(
          dark && "kds-theme kds-dark",
          "overflow-hidden rounded-[10px] border border-line bg-[var(--bg-elev)] shadow-lg outline-none",
        )}
      >
        <Dialog
          aria-label={ariaLabel ?? "Select time"}
          className="flex outline-none"
          style={{ height: 200 }}
        >
          <TimeColumn
            heading="Hour"
            values={HOURS}
            selected={selHour}
            open={open}
            isDisabled={hourDisabled}
            onSelect={(n) => setPart("hour", n)}
          />
          <div className="w-px self-stretch bg-line" />
          <TimeColumn
            heading="Min"
            values={MINUTES}
            selected={selMinute}
            open={open}
            isDisabled={minuteDisabled}
            onSelect={(n) => setPart("minute", n)}
          />
        </Dialog>
      </Popover>

      <FieldError className="text-xs text-red-600" />
    </TimeField>
  );
}

export function TimeColumn({
  heading,
  values,
  selected,
  onSelect,
  open,
  isDisabled,
}: {
  heading: string;
  values: number[];
  selected: number | null;
  onSelect: (n: number) => void;
  open: boolean;
  isDisabled?: (n: number) => boolean;
}) {
  const selRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && selRef.current) {
      selRef.current.scrollIntoView({ block: "center" });
    }
  }, [open]);

  return (
    <div className="flex w-16 flex-col">
      <div className="px-2 pb-1 pt-2 text-center text-[10px] font-semibold uppercase tracking-wider text-ink-dim">
        {heading}
      </div>
      <div
        className="flex-1 space-y-0.5 overflow-y-auto px-1 pb-1"
        style={{ scrollbarWidth: "thin" }}
      >
        {values.map((v) => {
          const isSel = v === selected;
          const disabled = isDisabled?.(v) ?? false;
          return (
            <button
              key={v}
              type="button"
              ref={isSel ? selRef : undefined}
              disabled={disabled}
              onClick={() => onSelect(v)}
              className={cn(
                "block w-full rounded-md px-2 py-1 text-center font-mono text-[13px] tabular-nums transition-colors",
                disabled
                  ? "cursor-not-allowed text-ink-dim/40"
                  : isSel
                    ? "bg-clay-500 font-semibold text-white"
                    : "text-ink hover:bg-[var(--line)]",
              )}
            >
              {String(v).padStart(2, "0")}
            </button>
          );
        })}
      </div>
    </div>
  );
}
