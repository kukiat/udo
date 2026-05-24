"use client";

import {
  Button,
  FieldError,
  Group,
  Input,
  Label,
  NumberField as AriaNumberField,
  type NumberFieldProps,
} from "react-aria-components";

import { cn } from "@/lib/cn";

export function NumberField({
  label,
  className,
  ...props
}: NumberFieldProps & { label?: string; className?: string }) {
  return (
    <AriaNumberField
      {...props}
      className={cn("flex flex-col gap-1.5", className)}
    >
      {label && (
        <Label className="text-sm font-medium text-ink-soft">{label}</Label>
      )}
      <Group className="inline-flex items-center rounded-xl border border-line bg-white overflow-hidden focus-within:border-clay-300 focus-within:ring-2 focus-within:ring-clay-100">
        <Button
          slot="decrement"
          className="px-3 py-2 text-ink-muted hover:bg-sand outline-none"
        >
          −
        </Button>
        <Input className="w-14 text-center text-sm text-ink outline-none py-2" />
        <Button
          slot="increment"
          className="px-3 py-2 text-ink-muted hover:bg-sand outline-none"
        >
          +
        </Button>
      </Group>
      <FieldError className="text-xs text-red-600" />
    </AriaNumberField>
  );
}
