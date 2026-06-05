"use client";

import { useId, type ReactNode } from "react";

const DEFAULT_ICON = (
  <svg
    viewBox="0 0 24 24"
    width={14}
    height={14}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

/**
 * Generic themed input. Started life as the dashboard's search field
 * (icon-prefixed, rounded, surface-elev background) and now serves as
 * the shared text-input primitive across the dashboard:
 *
 *   - default: single-line search input with magnifier icon
 *   - `icon={null}`: plain styled text input (any HTML `type`)
 *   - `multiline`: renders a `<textarea>` with the same styling
 *   - `mono`: tabular-nums + monospace font (for numeric fields)
 */
export function TextInput({
  value,
  onChange,
  placeholder,
  width = 260,
  height = 38,
  ariaLabel,
  icon = DEFAULT_ICON,
  type = "search",
  multiline = false,
  rows = 2,
  min,
  mono = false,
  inputMode,
  inputStyle,
  invalid = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Container width in px (or any CSS length). Use "100%" to fill the parent. */
  width?: number | string;
  /** Control height in px. Ignored when `multiline`. */
  height?: number;
  ariaLabel?: string;
  /** Leading icon. Pass `null` to render a plain styled input. */
  icon?: ReactNode | null;
  /** Underlying input type. Defaults to `search`. Ignored when `multiline`. */
  type?: React.HTMLInputTypeAttribute;
  /** Render a `<textarea>` instead of `<input>`. */
  multiline?: boolean;
  /** Rows for the textarea (multiline only). */
  rows?: number;
  /** `min` attribute for numeric inputs. */
  min?: number;
  /** Apply tabular-nums + monospace font (useful for numeric fields). */
  mono?: boolean;
  /** `inputMode` hint for soft keyboards (e.g. "decimal", "numeric"). */
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  /** Extra styles merged into the input/textarea (e.g. compact padding, color). */
  inputStyle?: React.CSSProperties;
  /** Render an error-colored border (e.g. when the field has a validation error). */
  invalid?: boolean;
}) {
  const id = useId();
  const hasIcon = icon !== null && !multiline;

  const ERROR_COLOR = "oklch(0.75 0.16 18)";

  const sharedStyle: React.CSSProperties = {
    width: "100%",
    padding: hasIcon ? "0 12px 0 34px" : multiline ? "8px 12px" : "0 12px",
    background: "var(--bg-elev)",
    border: `1px solid ${invalid ? ERROR_COLOR : "var(--line)"}`,
    borderRadius: 10,
    fontSize: 13,
    color: "var(--ink)",
    outline: "none",
    fontFamily: mono ? "var(--font-mono)" : "inherit",
    fontVariantNumeric: mono ? "tabular-nums" : "normal",
    resize: multiline ? "vertical" : undefined,
  };

  const onFocus = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    e.currentTarget.style.borderColor = invalid ? ERROR_COLOR : "var(--ink-2)";
  };
  const onBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    e.currentTarget.style.borderColor = invalid ? ERROR_COLOR : "var(--line)";
  };

  return (
    <div
      style={{
        position: "relative",
        width,
        height: multiline ? "auto" : height,
      }}
    >
      {hasIcon && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--ink-4)",
            pointerEvents: "none",
            display: "inline-flex",
          }}
        >
          {icon}
        </span>
      )}
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          rows={rows}
          style={{ ...sharedStyle, minHeight: 56, ...inputStyle }}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          min={min}
          inputMode={inputMode}
          style={{ ...sharedStyle, height: "100%", ...inputStyle }}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      )}
    </div>
  );
}
