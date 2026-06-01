"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Loading } from "@/components/ui/States";
import { api } from "@/lib/fetcher";

type Bootstrap = {
  restaurant: { name: string };
  branch: { id: string; name: string };
};

const ROLES = [
  {
    href: "/waitstaff",
    name: "Waitstaff",
    blurb:
      "Open tables, monitor orders, mark served. Optimized for floor tablets.",
    pose: "TABLET",
    tone: "olive" as const,
  },
  {
    href: "/kds",
    name: "Kitchen Display",
    blurb:
      "Real-time ticket board across stations. Dark theme, urgent color coding.",
    pose: "LARGE DISPLAY",
    tone: "accent" as const,
  },
  {
    href: "/pos",
    name: "Point of Sale",
    blurb: "Shifts, cash drawer, payments, printable receipts.",
    pose: "DESKTOP / TABLET",
    tone: "amber" as const,
  },
  {
    href: "/dashboard",
    name: "Admin",
    blurb: "Restaurants, branches, menu, branch overrides, sales reports.",
    pose: "DESKTOP",
    tone: "neutral" as const,
  },
];

const TONE_COLOR: Record<string, string> = {
  accent: "var(--accent)",
  olive: "var(--olive)",
  amber: "var(--amber)",
  neutral: "var(--ink)",
};

export default function Home() {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState("");

  useEffect(() => {
    api<Bootstrap>("/api/bootstrap")
      .then(setData)
      .catch((e) => setError(e.message));
    setToday(
      new Date().toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    );
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-cream/85 px-6 py-5 backdrop-blur lg:px-10">
        <div className="inline-flex items-center gap-2.5">
          <span className="relative inline-block h-5 w-5 rounded-full bg-ink">
            <span className="absolute inset-[20%] rounded-full bg-clay-500" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            Marrow
          </span>
        </div>
        <div className="flex items-center gap-5 text-[12px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-marrow-blink rounded-full bg-olive" />
            {data?.branch?.name ? `Live · ${data.branch.name}` : "Offline"}
          </span>
          <span className="mono tabular-nums">{today}</span>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-[1200px] px-6 pt-8 lg:px-10 lg:pt-12">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-muted">
          Restaurant management system · v1.0
        </div>
        <h1 className="mt-4 max-w-[800px] text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] text-ink lg:text-[64px]">
          One system,
          <br />
          <span className="text-ink-muted">
            from the dining room to the pass.
          </span>
        </h1>
        <p className="mt-5 max-w-[560px] text-[15px] leading-relaxed text-ink-muted">
          Pick a role to enter. Orders placed in one module flow live to the
          others — every ticket, every table, every metric stays in sync.
        </p>

        {/* Live status strip */}
        <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-card border border-line bg-white px-5 py-4 shadow-card">
          <Stat label="Status" value={data ? "Connected" : "—"} accent />
          <Divider />
          <Stat label="Restaurant" value={data?.restaurant.name ?? "—"} />
          <Divider />
          <Stat label="Active branch" value={data?.branch.name ?? "—"} />
          <Divider />
          <Stat label="Sample data" value="3 stations · 5 tables" />
        </div>
      </section>

      {/* Role grid */}
      <section className="mx-auto w-full max-w-[1200px] px-6 pb-12 pt-10 lg:px-10">
        {error ? (
          <p className="rounded-card border border-rose bg-rose-soft p-4 text-center text-sm text-rose">
            {error} — have you run the seed (<code className="mono">npm run db:seed</code>)?
          </p>
        ) : !data ? (
          <Loading label="Loading demo data…" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((r, i) => (
              <RoleCard key={r.href} role={r} index={i} />
            ))}
          </div>
        )}
      </section>

      <div className="flex-1" />

      <footer className="flex items-center justify-between border-t border-line px-6 py-6 text-[11px] text-ink-dim lg:px-10">
        <span>© Marrow Hospitality · Self-Order · KDS · POS · Menu</span>
        <span className="mono">v1.0</span>
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-muted">
        {label}
      </div>
      <div className="mono inline-flex items-center gap-1.5 text-[16px] font-semibold tracking-[-0.015em] text-ink">
        {accent && (
          <span className="h-1.5 w-1.5 animate-marrow-blink rounded-full bg-clay-500" />
        )}
        {value}
      </div>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="h-7 w-px bg-line-strong/60" />;
}

function RoleCard({
  role,
  index,
}: {
  role: (typeof ROLES)[number];
  index: number;
}) {
  const tone = TONE_COLOR[role.tone];
  return (
    <Link
      href={role.href}
      className="group relative animate-slide-up overflow-hidden rounded-lg border border-line bg-white p-6 shadow-card transition-all hover:-translate-y-1 hover:border-line-strong hover:shadow-elev"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      {/* Top accent stripe */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] opacity-60 transition-opacity group-hover:opacity-100"
        style={{ background: tone }}
      />

      {/* Icon + index */}
      <div className="flex items-center justify-between">
        <div
          className="grid h-10 w-10 place-items-center rounded-md bg-sand"
          style={{ color: tone }}
        >
          <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 8h12M8 2v12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="mono text-[10px] tracking-[0.08em] text-ink-dim">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      {/* Name + blurb */}
      <div className="mt-6 text-[18px] font-semibold tracking-[-0.01em] text-ink">
        {role.name}
      </div>
      <p className="mt-2 min-h-[64px] text-[13px] leading-relaxed text-ink-muted">
        {role.blurb}
      </p>

      {/* Footer */}
      <div className="mt-5 flex items-center justify-between border-t border-line pt-3.5">
        <span className="mono text-[10px] tracking-[0.06em] text-ink-dim">
          {role.pose}
        </span>
        <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-soft transition-colors group-hover:text-clay-500">
          Enter
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </Link>
  );
}
