"use client";

import {
  ArrowRight,
  ClipboardList,
  LayoutDashboard,
  Monitor,
} from "lucide-react";
import Link from "next/link";

import { TopBar } from "@/components/dashboard/TopBar";

const MENU_ITEMS = [
  {
    key: "kds",
    label: "KDS",
    detail: "Kitchen display",
    blurb:
      "Open the kitchen board, filter stations, advance tickets, and keep orders moving.",
    pose: "KITCHEN",
    tone: "accent" as const,
    href: () => "/kds",
    icon: Monitor,
  },
  {
    key: "dashboard",
    label: "Dashboard",
    detail: "Admin and reports",
    blurb:
      "Run restaurants, branches, menu setup, branch overrides, and sales reports.",
    pose: "ADMIN",
    tone: "neutral" as const,
    href: () => "/dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "staff",
    label: "Staff",
    detail: "Floor service",
    blurb:
      "Monitor tables, add floor tables, and mark ready orders as served.",
    pose: "FLOOR",
    tone: "olive" as const,
    href: () => "/waitstaff",
    icon: ClipboardList,
  },
];

const TONE_COLOR: Record<(typeof MENU_ITEMS)[number]["tone"], string> = {
  accent: "var(--accent)",
  olive: "var(--olive)",
  neutral: "var(--ink)",
};

export default function Home() {
  return (
    <div
      className="kds-theme kds-dark min-h-screen"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <TopBar
        role="RMS"
        showLive={false}
        left={
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "-0.005em",
              color: "var(--ink-2)",
            }}
          >
            Home
          </span>
        }
      />
      <main
        className="mx-auto"
        style={{ padding: "28px 32px 80px", maxWidth: 1280 }}
      >
        <section>
          <div
            className="mono"
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
              marginBottom: 10,
            }}
          >
            <span style={{ color: "var(--ink-2)" }}>Marrow</span>
            <span style={{ margin: "0 8px", color: "var(--ink-4)" }}>/</span>
            <span>Restaurant Management System</span>
          </div>

          <div className="mb-[22px] flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h1
                style={{
                  fontSize: 30,
                  fontWeight: 600,
                  letterSpacing: "-0.025em",
                  lineHeight: 1.05,
                  color: "var(--ink)",
                }}
              >
                Open a workspace
              </h1>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--ink-3)",
                  marginTop: 6,
                  maxWidth: 560,
                }}
              >
                Kitchen display, dashboard management, and floor staff tools in
                one focused service workspace.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MENU_ITEMS.map((item, index) => {
              const href = item.href();
              return (
                <MenuItem
                  key={item.key}
                  item={item}
                  href={href}
                  index={index}
                />
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function MenuItem({
  item,
  href,
  index,
}: {
  item: (typeof MENU_ITEMS)[number];
  href: string;
  index: number;
}) {
  const Icon = item.icon;
  const tone = TONE_COLOR[item.tone];
  const content = (
    <>
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] opacity-60 transition-opacity group-hover:opacity-100"
        style={{ background: tone }}
      />

      <span className="flex items-center justify-between">
        <span
          className="grid h-10 w-10 place-items-center rounded-md bg-sand"
          style={{ color: tone }}
        >
          <Icon aria-hidden size={19} strokeWidth={1.8} />
        </span>
        <span className="mono text-[10px] tracking-[0.08em] text-ink-dim">
          {String(index + 1).padStart(2, "0")}
        </span>
      </span>

      <span className="mt-6 block text-[18px] font-semibold tracking-[-0.01em] text-ink">
        {item.label}
      </span>
      <span className="mt-2 block min-h-[64px] text-[13px] leading-relaxed text-ink-muted">
        {item.blurb}
      </span>

      <span className="mt-5 flex items-center justify-between border-t border-line pt-3.5">
        <span className="mono text-[10px] tracking-[0.06em] text-ink-dim">
          {item.pose}
        </span>
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-soft transition-colors group-hover:text-clay-500">
          Enter
          <ArrowRight aria-hidden size={12} strokeWidth={1.8} />
        </span>
      </span>
    </>
  );

  const className =
    "group relative animate-slide-up overflow-hidden rounded-lg border border-line bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:border-line-strong hover:shadow-elev";
  const style = { animationDelay: `${index * 70}ms` };

  return (
    <Link href={href} className={className} style={style}>
      {content}
    </Link>
  );
}
