"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { AccountMenu } from "@/components/ui/AccountMenu";
import { Select } from "@/components/ui/Select";
import { useRestaurant } from "@/contexts/RestaurantContext";

// Marrow brand mark: ink ring with a coral inner dot, followed by the
// "Marrow" wordmark. Sized to match the KDS header brand mark.
function MarrowBrand() {
  return (
    <Link
      href="/"
      aria-label="Go to home"
      className="flex items-center gap-2.5 rounded-md transition-opacity hover:opacity-80"
    >
      <span
        className="relative inline-block h-[22px] w-[22px] rounded-full bg-[var(--ink)]"
      >
        <span
          className="absolute inset-[20%] rounded-full bg-[var(--accent)]"
        />
      </span>
      <span
        className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--ink)]"
      >
        Marrow
      </span>
    </Link>
  );
}

const VDivider = () => (
  <span aria-hidden className="h-6 w-px bg-line" />
);

export function TopBar({
  role,
  left,
  right,
  showLive = true,
  liveLabel = "Live",
  liveTone = "olive",
}: {
  role?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  showLive?: boolean;
  liveLabel?: string;
  liveTone?: "olive" | "neutral";
}) {
  const isOn = liveTone === "olive";
  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between h-[64px] px-[20px] bg-[var(--bg-elev)] border-b border-[var(--line,var(--border))]"
    >
      <div className="flex min-w-0 items-center gap-4">
        <MarrowBrand />
        {(role || left) && (
          <>
            <span
              aria-hidden
              className="w-[1px] h-6 bg-[var(--line)]"
            />
            <div className="flex min-w-0 items-baseline gap-3">
              {role && (
                <span
                  className="text-[11px] text-ink-soft tracking-[0.12em] uppercase font-semibold"
                >
                  {role}
                </span>
              )}
              {left && <div className="min-w-0">{left}</div>}
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {right}
        {(right || showLive) && (
          <span
            aria-hidden
            className="w-px h-7 bg-[var(--line)] mx-1.5"
          />
        )}
        {showLive && (
          <span
            className={`inline-flex items-center gap-2 px-[10px] py-[5px] rounded-full border text-[11px] font-semibold tracking-[0.06em] uppercase
              ${isOn
                ? "border-olive bg-olive-soft text-olive"
                : "border-[var(--line-strong)] bg-[var(--bg-sunken)] text-[var(--ink-3)]"
              }`}
          >
            <span
              className={
                `${isOn ? "bg-[var(--olive)] animate-[blink_1.6s_infinite]" : "bg-[var(--ink-3)]"} ` +
                "w-[6px] h-[6px] rounded-full inline-block"
              }
            />
            {liveLabel}
          </span>
        )}
        <AccountMenu />
      </div>
    </header>
  );
}

// Top-left branch switcher — KDS-style inline mono text "Restaurant · Branch"
// that opens a popover with all branches. Mirrors the KDS header subtext.
function BranchSwitcher() {
  const { restaurantName, branches, branchId, setBranch } = useRestaurant();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!branches.length) return null;
  const active = branches.find((b) => b.id === branchId) ?? branches[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`mono inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 transition-colors text-[11px] ${
          open
            ? "text-[var(--ink-2)] bg-[var(--bg-sunken)]"
            : "text-[var(--ink-4)] bg-transparent"
        } border-transparent`}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.classList.add("bg-[var(--bg-sunken)]");
            e.currentTarget.classList.add("text-[var(--ink-2)]");
            e.currentTarget.classList.remove("text-[var(--ink-4)]");
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.classList.remove("bg-[var(--bg-sunken)]");
            e.currentTarget.classList.remove("text-[var(--ink-2)]");
            e.currentTarget.classList.add("text-[var(--ink-4)]");
          }
        }}
      >
        <span className="max-w-[280px] truncate">
          {restaurantName ?? "—"} · {active?.name ?? ""}
        </span>
        <span
          aria-hidden
          className={`transition-transform text-[9px] opacity-70 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 z-[95] mt-2 w-[288px] animate-slide-up rounded-[16px] border border-line bg-white p-2 shadow-pop"
        >
          <div className="px-2.5 pb-2 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Switch branch
          </div>
          <div className="flex flex-col gap-0.5">
            {branches.map((b) => {
              const isActive = b.id === branchId;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    setBranch(b.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md border-0 px-2.5 py-2 text-left transition-colors ${
                    isActive ? "bg-[var(--bg-sunken)]" : "bg-transparent"
                  }`}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.classList.add("bg-[var(--bg-sunken)]");
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.classList.remove("bg-[var(--bg-sunken)]");
                  }}
                >
                  <span
                    className={`flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-md text-[14px] ${
                      isActive
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "bg-[var(--bg-sunken)] text-[var(--ink-3)]"
                    }`}
                    aria-hidden
                  >
                    ⌂
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[13px] font-semibold tracking-[-0.01em]"
                    >
                      {b.name}
                    </span>
                    <span className="block truncate text-[11px] text-ink-muted">
                      {b.address ?? "—"}
                    </span>
                  </span>
                  {isActive && (
                    <span
                      aria-hidden
                      className="flex-shrink-0 text-clay-500 text-[14px]"
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Standalone branch pill — used outside the dashboard scope (e.g. waitstaff)
// where the RestaurantContext isn't available. Mirrors the Marrow
// BranchSwitcher in the dashboard but takes branches/branchId/onChange props.
export function BranchPill({
  branches,
  branchId,
  onChange,
}: {
  branches: { id: string; name: string }[];
  branchId: string | null;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!branches.length) return null;
  const active = branches.find((b) => b.id === branchId) ?? branches[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`inline-flex h-[34px] items-center gap-2 rounded-full border bg-transparent py-1 pl-2.5 pr-2 transition-colors ${
          open
            ? "border-[var(--line-strong)] bg-[var(--bg-sunken)]"
            : "border-[var(--line)] bg-transparent"
        }`}
        onMouseEnter={(e) => {
          if (!open)
            e.currentTarget.classList.add("bg-[var(--bg-sunken)]");
        }}
        onMouseLeave={(e) => {
          if (!open)
            e.currentTarget.classList.remove("bg-[var(--bg-sunken)]");
        }}
      >
        <span
          aria-hidden
          className="text-ink-muted text-[14px] leading-none"
        >
          ⌂
        </span>
        <span className="flex flex-col items-start leading-[1.1]">
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            Branch
          </span>
          <span
            className="max-w-[160px] truncate text-[12.5px] font-semibold text-ink tracking-[-0.01em]"
          >
            {active.name}
          </span>
        </span>
        <span
          aria-hidden
          className={`text-ink-muted transition-transform text-[10px] ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 z-[95] mt-2 w-[288px] animate-slide-up rounded-[16px] border border-line bg-white p-2 shadow-pop"
        >
          <div className="px-2.5 pb-2 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
            Switch branch
          </div>
          <div className="flex flex-col gap-0.5">
            {branches.map((b) => {
              const isActive = b.id === branchId;
              return (
                <button
                  key={b.id}
                  onClick={() => {
                    onChange(b.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md border-0 px-2.5 py-2 text-left transition-colors ${
                    isActive ? "bg-[var(--bg-sunken)]" : "bg-transparent"
                  }`}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.classList.add("bg-[var(--bg-sunken)]");
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.classList.remove("bg-[var(--bg-sunken)]");
                  }}
                >
                  <span
                    className={`flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-md text-[14px] ${
                      isActive
                        ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                        : "bg-[var(--bg-sunken)] text-[var(--ink-3)]"
                    }`}
                    aria-hidden
                  >
                    ⌂
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className="block truncate text-[13px] font-semibold tracking-[-0.01em]"
                    >
                      {b.name}
                    </span>
                  </span>
                  {isActive && (
                    <span
                      aria-hidden
                      className="flex-shrink-0 text-clay-500 text-[14px]"
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Backwards-compatible alias — older callers passed `label` instead of `role`
// and didn't want the Live pill rendered automatically.
export function MarrowTopBar({
  label,
  right,
}: {
  label?: string;
  right?: React.ReactNode;
}) {
  return <TopBar role={label} right={right} showLive={false} />;
}

function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  const nextLabel = theme === "light" ? "Dark" : "Light";
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${nextLabel} theme`}
      title={`Switch to ${nextLabel} theme`}
      className="btn-quiet flex items-center gap-[6px] rounded-[8px] px-[10px] py-[6px] text-[12px] text-[var(--ink-2)] tracking-[0.02em]"
    >
      <span aria-hidden className="text-[13px] leading-none">
        {theme === "light" ? "◐" : "○"}
      </span>
      {nextLabel}
    </button>
  );
}

// Per-restaurant topbar — Marrow design, KDS-aligned. Brand + divider +
// "Management" section label with mono "Restaurant · Branch" subtext (the
// subtext is the branch switcher trigger). Mirrors the KDS header layout.
export function RestaurantTopBar({
  theme,
  onToggleTheme,
}: {
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
} = {}) {
  const { branches, branchName } = useRestaurant();
  const liveLabel =
    branches.length > 0 && branchName ? `Live · ${branchName}` : "Live";
  return (
    <TopBar
      role="Admin"
      left={branches.length > 0 ? <BranchSwitcher /> : null}
      right={
        theme && onToggleTheme ? (
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        ) : undefined
      }
      liveLabel={liveLabel}
      showLive
    />
  );
}

// Kept exported for any older imports.
export { Select };
