"use client";

import { parseTime } from "@internationalized/date";
import {
  DateInput,
  DateSegment,
  FieldError,
  Label,
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

export function TimePicker({
  label,
  value,
  onChange,
  ariaLabel,
  width = "100%",
  height = 38,
  className,
}: {
  label?: string;
  value?: string | null;
  onChange?: (value: string) => void;
  ariaLabel?: string;
  width?: number | string;
  height?: number;
  className?: string;
}) {
  return (
    <TimeField
      value={toTimeValue(value)}
      onChange={(v) => v && onChange?.(formatTime(v))}
      granularity="minute"
      hourCycle={24}
      aria-label={ariaLabel}
      className={cn("flex flex-col gap-1.5", className)}
      style={{ width }}
    >
      {label && (
        <Label className="text-[13px] font-medium text-ink-soft">{label}</Label>
      )}
      <DateInput
        className={cn(
          "inline-flex items-center rounded-[10px] border border-line bg-[var(--bg-elev)] px-3 font-mono text-[13px] text-ink outline-none transition-colors",
          "focus-within:border-ink-soft",
        )}
        style={{ height }}
      >
        {(segment) => (
          <DateSegment
            segment={segment}
            className={cn(
              "rounded px-0.5 tabular-nums caret-transparent outline-none",
              "data-[placeholder]:text-ink-muted data-[focused]:bg-ink data-[focused]:text-white",
            )}
          />
        )}
      </DateInput>
      <FieldError className="text-xs text-red-600" />
    </TimeField>
  );
}
