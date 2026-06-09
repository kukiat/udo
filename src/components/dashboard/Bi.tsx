// English label helpers for the dashboard.

export function Bi({
  en,
  className,
}: {
  th?: string;
  en: string;
  className?: string;
}) {
  return (
    <span className={`bi ${className ?? ""}`}>
      <span className="bi-th">{en}</span>
    </span>
  );
}

// Inline form labels used in body copy, tables, and chips.
export function BiInline({
  en,
  className,
}: {
  th?: string;
  en: string;
  className?: string;
}) {
  return <span className={className}>{en}</span>;
}
