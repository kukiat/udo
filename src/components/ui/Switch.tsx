"use client";

import { Switch as AriaSwitch, type SwitchProps } from "react-aria-components";

import { cn } from "@/lib/cn";

export function Switch({
  children,
  className,
  ...props
}: Omit<SwitchProps, "children"> & {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <AriaSwitch
      {...props}
      className={cn(
        "group inline-flex items-center gap-2 text-sm text-ink-soft cursor-pointer",
        className,
      )}
    >
      <span className="h-6 w-10 rounded-full bg-line p-0.5 transition-colors group-selected:bg-clay-500 group-data-[disabled]:opacity-50">
        <span
          className="block h-5 w-5 rounded-full shadow transition-transform group-selected:translate-x-4"
          style={{ backgroundColor: "#fff" }}
        />
      </span>
      {children}
    </AriaSwitch>
  );
}
