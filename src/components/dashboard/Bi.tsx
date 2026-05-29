// Bilingual TH/EN helpers for the Neon Diner dashboard.
// Thai is primary (larger), English secondary (smaller, uppercase, dimmer).

export function Bi({
  th,
  en,
  className,
}: {
  th: string;
  en: string;
  className?: string;
}) {
  return (
    <span className={`bi ${className ?? ""}`}>
      <span className="bi-th">{th}</span>
      <span className="bi-en">{en}</span>
    </span>
  );
}

// Inline form: "ไทย · ENGLISH" — used in body copy, tables, chips.
export function BiInline({
  th,
  en,
  className,
}: {
  th: string;
  en: string;
  className?: string;
}) {
  return (
    <span className={className}>
      {th} <span style={{ color: "var(--text-3)" }}>· {en}</span>
    </span>
  );
}
