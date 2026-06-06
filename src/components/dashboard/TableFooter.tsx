import type { ReactNode } from "react";

type DashboardTableFooterProps = {
  page?: number;
  pageCount?: number;
  total: number;
  pageSize?: number;
  noun?: string;
  onChange?: (next: number) => void;
};

export function DashboardTableFooter({
  page,
  pageCount,
  total,
  pageSize,
  noun = "items",
  onChange,
}: DashboardTableFooterProps) {
  const hasPagination =
    page != null && pageCount != null && pageSize != null && onChange != null;
  const from = hasPagination && total > 0 ? (page - 1) * pageSize + 1 : total;
  const to = hasPagination ? Math.min(page * pageSize, total) : total;
  const pages = hasPagination ? getPageList(page, pageCount) : [];

  const go = (next: number) => {
    if (!hasPagination) return;
    const clamped = Math.min(pageCount, Math.max(1, next));
    if (clamped !== page) onChange(clamped);
  };

  return (
    <div
      className="r-table-footer"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 18px",
        borderTop: "1px solid var(--line)",
        background: "var(--bg-elev)",
      }}
    >
      <div className="tnum" style={{ fontSize: 12, color: "var(--ink-3)" }}>
        Showing{" "}
        {hasPagination ? (
          <>
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>{from}</span>
            {"-"}
            <span style={{ color: "var(--ink)", fontWeight: 600 }}>{to}</span>{" "}
            of{" "}
          </>
        ) : null}
        <span style={{ color: "var(--ink)", fontWeight: 600 }}>{total}</span>{" "}
        {noun}
      </div>

      {hasPagination ? (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <PageBtn
            disabled={page <= 1}
            onClick={() => go(page - 1)}
            aria-label="Previous page"
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <svg
                viewBox="0 0 24 24"
                width={11}
                height={11}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Prev
            </span>
          </PageBtn>
          {pages.map((p, i) =>
            p === "..." ? (
              <span
                key={`e${i}`}
                style={{
                  width: 32,
                  textAlign: "center",
                  fontSize: 13,
                  color: "var(--ink-4)",
                }}
              >
                ...
              </span>
            ) : (
              <PageBtn
                key={p}
                active={p === page}
                onClick={() => go(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </PageBtn>
            ),
          )}
          <PageBtn
            disabled={page >= pageCount}
            onClick={() => go(page + 1)}
            aria-label="Next page"
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              Next
              <svg
                viewBox="0 0 24 24"
                width={11}
                height={11}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </span>
          </PageBtn>
        </div>
      ) : null}
    </div>
  );
}

function getPageList(page: number, pageCount: number): (number | "...")[] {
  const pages: (number | "...")[] = [];
  if (pageCount <= 7) {
    for (let i = 1; i <= pageCount; i++) pages.push(i);
    return pages;
  }

  pages.push(1);
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < pageCount - 1) pages.push("...");
  pages.push(pageCount);
  return pages;
}

function PageBtn({
  children,
  active,
  disabled,
  onClick,
  ...rest
}: {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
} & React.AriaAttributes) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 34,
        height: 32,
        padding: "0 11px",
        borderRadius: 8,
        border: "1px solid",
        borderColor: active ? "var(--ink)" : "var(--line)",
        background: active ? "var(--ink)" : "transparent",
        color: active ? "var(--bg-elev)" : "var(--ink-2)",
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "background 0.12s ease, color 0.12s ease",
      }}
      onMouseEnter={(e) => {
        if (active || disabled) return;
        e.currentTarget.style.background = "var(--bg-sunken)";
        e.currentTarget.style.color = "var(--ink)";
      }}
      onMouseLeave={(e) => {
        if (active || disabled) return;
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--ink-2)";
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
