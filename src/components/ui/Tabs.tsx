"use client";

import { cn } from "@/lib/cn";

export type TabOption = { id: string; label: string; count?: number };

export function Tabs({
  options,
  value,
  onChange,
  className,
}: {
  options: TabOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors outline-none",
              active
                ? "bg-clay-500 text-white"
                : "bg-white text-ink-soft border border-line hover:bg-sand",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-xs",
                  active ? "bg-white/20" : "bg-sand text-ink-muted",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
