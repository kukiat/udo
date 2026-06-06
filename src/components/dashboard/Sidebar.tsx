"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_COLLAPSED_KEY = "marrow.adminNav";

type NavItem = {
  href: string;
  th: string;
  en: string;
  icon: string;
  exact?: boolean;
};

function NavToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      title={collapsed ? "Expand" : "Collapse"}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="inline-flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink-muted transition-colors hover:bg-[var(--bg-sunken)] hover:text-[var(--ink)]"
 
    >
      <span aria-hidden style={{ fontSize: 12, lineHeight: 1 }}>
        {collapsed ? "›" : "‹"}
      </span>
    </button>
  );
}

function NavTip({
  label,
  show,
  children,
}: {
  label: string;
  show: boolean;
  children: React.ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
      {show && hover && (
        <div
          className="pointer-events-none absolute z-50 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium shadow-elev"
          style={{
            left: "calc(100% + 12px)",
            top: "50%",
            transform: "translateY(-50%)",
            background: "var(--ink)",
            color: "var(--bg)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ restaurantId }: { restaurantId?: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Hydrate the collapsed state from localStorage on mount to avoid SSR mismatch.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(NAV_COLLAPSED_KEY) === "collapsed");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(
          NAV_COLLAPSED_KEY,
          next ? "collapsed" : "expanded",
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Derive restaurantId from the route when not passed explicitly. Lets the
  // sidebar work in both the per-restaurant layout and any future contexts.
  const rid =
    restaurantId ??
    (pathname.startsWith("/dashboard/")
      ? pathname.split("/")[2]
      : undefined);
  const base = rid ? `/dashboard/${rid}` : "/dashboard";

  const items: NavItem[] = [
    { href: base, th: "ภาพรวม", en: "Overview", icon: "◆", exact: true },
    { href: `${base}/branches`, th: "สาขา", en: "Branches", icon: "⌂" },
    {
      href: `${base}/categories`,
      th: "หมวดหมู่",
      en: "Categories",
      icon: "◧",
    },
    { href: `${base}/menu`, th: "รายการเมนู", en: "Menu", icon: "☱" },
    {
      href: `${base}/branch-menu`,
      th: "เมนูสาขา",
      en: "Branch menu",
      icon: "⊞",
    },
    { href: `${base}/reports`, th: "รายงาน", en: "Reports", icon: "⌗" },
  ];

  return (
    <aside
      className="hidden flex-shrink-0 flex-col self-stretch overflow-hidden border-r border-line bg-cream md:flex"
      style={{
        width: collapsed ? 74 : 220,
        flexBasis: collapsed ? 74 : 220,
        transition: "width .26s cubic-bezier(.2,.7,.2,1), flex-basis .26s cubic-bezier(.2,.7,.2,1)",
      }}
    >
      {/* Header — ADMIN label + collapse toggle */}
      <div
        className="flex h-[52px] flex-shrink-0 items-center"
        style={{
          justifyContent: collapsed ? "center" : "space-between",
          padding: collapsed ? 0 : "0 12px 0 16px",
        }}
      >
        {!collapsed && (
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
            Admin
          </span>
        )}
        <NavToggle collapsed={collapsed} onToggle={toggle} />
      </div>

      {/* Nav — soft pill items */}
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-3 py-1">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <NavTip
              key={item.href}
              label={`${item.th} · ${item.en}`}
              show={collapsed}
            >
              <Link
                href={item.href}
                className="group flex h-[42px] w-full items-center rounded-full text-[13.5px] transition-colors"
                style={{
                  gap: 11,
                  justifyContent: collapsed ? "center" : "flex-start",
                  padding: collapsed ? 0 : "0 13px",
                  background: active ? "var(--accent-soft)" : "transparent",
                  color: active ? "var(--accent)" : "var(--ink-2)",
                  fontWeight: active ? 600 : 500,
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    e.currentTarget.style.background = "var(--bg-sunken)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  aria-hidden
                  className="flex-shrink-0"
                  style={{
                    fontSize: 16,
                    lineHeight: 1,
                    color: active ? "var(--accent)" : "var(--ink-3)",
                  }}
                >
                  {item.icon}
                </span>
                {!collapsed && (
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate" style={{ letterSpacing: "-0.01em" }}>
                      {item.th}
                    </span>
                    <span
                      className="truncate"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        fontWeight: 500,
                        color: active ? "var(--accent)" : "var(--ink-4)",
                        opacity: active ? 0.85 : 1,
                      }}
                    >
                      {item.en}
                    </span>
                  </span>
                )}
              </Link>
            </NavTip>
          );
        })}
      </nav>

      {/* Footer — sync status */}
      <div
        className="flex-shrink-0 border-t border-line"
        style={{ padding: collapsed ? "12px 0" : "12px 16px" }}
      >
        {collapsed ? (
          <div className="flex justify-center">
            <span className="h-[7px] w-[7px] animate-marrow-blink rounded-full bg-olive" />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[11px] text-ink-dim">
            <span className="h-1.5 w-1.5 flex-shrink-0 animate-marrow-blink rounded-full bg-olive" />
            <span className="mono">v3.2 · synced 12s ago</span>
          </div>
        )}
      </div>
    </aside>
  );
}
