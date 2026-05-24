"use client";

import {
  FieldError,
  Input,
  Label,
  TextArea,
  TextField as AriaTextField,
  type TextFieldProps,
} from "react-aria-components";

import { cn } from "@/lib/cn";

const inputClass = cn(
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink",
  "outline-none focus:border-clay-300 focus:ring-2 focus:ring-clay-100",
  "placeholder:text-ink-muted",
);

export function TextField({
  label,
  multiline,
  placeholder,
  className,
  ...props
}: TextFieldProps & {
  label?: string;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <AriaTextField {...props} className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label className="text-sm font-medium text-ink-soft">{label}</Label>
      )}
      {multiline ? (
        <TextArea placeholder={placeholder} className={cn(inputClass, "min-h-20 resize-y")} />
      ) : (
        <Input placeholder={placeholder} className={inputClass} />
      )}
      <FieldError className="text-xs text-red-600" />
    </AriaTextField>
  );
}
