"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/cn";
import type { AuthUser } from "@/lib/auth";

const ROLE_LABEL: Record<AuthUser["role"], string> = {
  owner: "Owner",
  admin: "Owner · Admin",
  branch_manager: "Branch manager",
  cashier: "Cashier",
  kitchen_staff: "Kitchen · Line",
  waitstaff: "Floor staff",
};

type Tone = "accent" | "olive" | "amber" | "neutral";

const ROLE_TONE: Record<AuthUser["role"], Tone> = {
  owner: "amber",
  admin: "amber",
  branch_manager: "olive",
  waitstaff: "olive",
  cashier: "accent",
  kitchen_staff: "accent",
};

const ACCESS_LABEL: Record<AuthUser["role"], string> = {
  owner: "Full access",
  admin: "Full access",
  branch_manager: "Branch scope",
  cashier: "POS · Bills",
  kitchen_staff: "KDS only",
  waitstaff: "Floor · Tables",
};

const TONE_CLASS: Record<Tone, { bg: string; fg: string; bgSoft: string }> = {
  accent: {
    bg: "bg-clay-500",
    fg: "text-clay-500",
    bgSoft: "bg-clay-100",
  },
  olive: {
    bg: "bg-olive",
    fg: "text-olive",
    bgSoft: "bg-olive-soft",
  },
  amber: {
    bg: "bg-amber",
    fg: "text-amber",
    bgSoft: "bg-amber-soft",
  },
  neutral: {
    bg: "bg-ink-muted",
    fg: "text-ink-soft",
    bgSoft: "bg-sand",
  },
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

function Avatar({
  initials: ini,
  size = 28,
  tone = "neutral",
}: {
  initials: string;
  size?: number;
  tone?: Tone;
}) {
  const t = TONE_CLASS[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold",
        t.bgSoft,
        t.fg,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        letterSpacing: "-0.01em",
      }}
    >
      {ini}
    </span>
  );
}

function Tag({
  children,
  tone = "neutral",
  size = "md",
}: {
  children: React.ReactNode;
  tone?: Tone;
  size?: "sm" | "md";
}) {
  const t = TONE_CLASS[tone];
  const pad = size === "sm" ? "px-1.5 py-[2px] text-[10px]" : "px-2 py-[3px] text-[11px]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        t.bgSoft,
        t.fg,
        pad,
      )}
    >
      {children}
    </span>
  );
}

// Icon glyph used in the detail rows. Stays a single character so we don't need
// to pull in an icon library; matches the visual weight of the rest of the
// dashboard (which already uses unicode glyphs in the sidebar).
const GLYPH: Record<string, string> = {
  store: "⌂",
  branch: "⌂",
  clock: "⏱",
  users: "☰",
  user: "○",
  shield: "◈",
  mail: "@",
  receipt: "❒",
  star: "★",
  flame: "✦",
  table: "▦",
};

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof GLYPH | string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span
        className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-md"
        style={{
          background: "var(--bg-sunken)",
          color: "var(--ink-3)",
          fontSize: 13,
        }}
        aria-hidden
      >
        {GLYPH[icon] ?? "○"}
      </span>
      <span
        className="flex-shrink-0 text-[12px]"
        style={{ color: "var(--ink-3)" }}
      >
        {label}
      </span>
      <span
        className="ml-auto truncate text-right text-[12.5px] font-medium"
        style={{ color: "var(--ink)" }}
      >
        {value}
      </span>
    </div>
  );
}

// Udo ProfileMenu — replaces the old AccountMenu. Avatar pill trigger →
// popover with quick stats + actions → full detail modal. Compact mode strips
// the name/role labels for narrow headers (KDS, mobile).
//
// The trigger reads colors from CSS custom properties (`--ink`, `--ink-3`,
// `--line`, `--bg-sunken`), so it inherits whatever theme the surrounding
// surface uses — light by default, but flipped to dark on the KDS dark
// header (`.kds-theme.kds-dark` in globals.css). No `dark` prop needed.
export function AccountMenu({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Role-driven copy + tone. Memoized so it doesn't recompute every render.
  const profile = useMemo(() => {
    if (!user) return null;
    const tone = ROLE_TONE[user.role];
    const roleLabel = ROLE_LABEL[user.role];
    const access = ACCESS_LABEL[user.role];
    const stats: { label: string; value: string }[] = [
      {
        label: "Role",
        value: roleLabel.split(" · ")[0] ?? roleLabel,
      },
      {
        label: "Scope",
        value: user.branchId ? "Branch" : "Restaurant",
      },
      { label: "Access", value: access.split(" ")[0] ?? "Full" },
    ];
    const details: { icon: string; label: string; value: string }[] = [
      { icon: "shield", label: "Access", value: access },
      {
        icon: user.branchId ? "branch" : "store",
        label: user.branchId ? "Branch" : "Scope",
        value: user.branchId ? "Branch-scoped" : "All branches",
      },
      { icon: "mail", label: "Email", value: user.email },
      { icon: "user", label: "Staff ID", value: user.id.slice(0, 8).toUpperCase() },
    ];
    return { tone, roleLabel, access, stats, details };
  }, [user]);

  if (!user || !profile) return null;
  const t = TONE_CLASS[profile.tone];
  const TONE_VAR: Record<Tone, string> = {
    accent: "var(--clay-500, #c45a3a)",
    olive: "var(--olive, #6a7548)",
    amber: "var(--amber, #c98a14)",
    neutral: "var(--ink-3)",
  };
  const roleColor = TONE_VAR[profile.tone];

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Trigger — colors driven by CSS custom properties so the pill inherits
          the surrounding surface theme (light dashboard / dark KDS header). */}
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "btn-quiet h-9 rounded-full outline-none",
          compact ? "px-1" : "pl-1 pr-2",
        )}
        style={
          open
            ? {
                borderColor: "var(--line-strong)",
                background: "var(--bg-sunken)",
              }
            : undefined
        }
      >
        <Avatar initials={initials(user.name)} size={28} tone={profile.tone} />
        {!compact && (
          <span
            className="flex flex-col items-start leading-[1.1]"
            style={{ letterSpacing: "-0.01em" }}
          >
            <span
              className="text-[12.5px] font-semibold"
              style={{ color: "var(--ink)" }}
            >
              {user.name}
            </span>
            <span
              className="text-[10px] font-medium"
              style={{ color: roleColor }}
            >
              {profile.roleLabel}
            </span>
          </span>
        )}
        <span
          aria-hidden
          style={{ fontSize: 10, color: "var(--ink-3)" }}
        >
          ▾
        </span>
      </button>

      {/* Popover — surface, border, and inner tiles are CSS-var driven so the
          card flips with the surrounding theme (light dashboard, dark KDS). */}
      {open && (
        <div
          className="absolute right-0 z-[95] mt-2 w-[272px] animate-slide-up rounded-lg border p-3.5 shadow-pop"
          style={{
            background: "var(--bg-elev)",
            borderColor: "var(--line)",
            borderRadius: 16,
          }}
        >
          <div className="flex items-center gap-3">
            <Avatar
              initials={initials(user.name)}
              size={44}
              tone={profile.tone}
            />
            <div className="min-w-0 flex-1">
              <div
                className="truncate text-[15px] font-semibold"
                style={{ letterSpacing: "-0.015em", color: "var(--ink)" }}
              >
                {user.name}
              </div>
              <div className="mt-1">
                <Tag tone={profile.tone} size="sm">
                  {profile.roleLabel}
                </Tag>
              </div>
            </div>
          </div>
          <div
            className="mono mt-2.5 truncate text-[11px]"
            style={{ color: "var(--ink-3)" }}
          >
            {user.email}
          </div>

          <div className="my-3 h-px" style={{ background: "var(--line)" }} />

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2">
            {profile.stats.map((s) => (
              <div
                key={s.label}
                className="rounded-md px-1.5 py-2 text-center"
                style={{ background: "var(--bg-sunken)" }}
              >
                <div
                  className="tnum truncate text-[14px] font-semibold"
                  style={{ letterSpacing: "-0.02em", color: "var(--ink)" }}
                >
                  {s.value}
                </div>
                <div
                  className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "var(--ink-3)" }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div className="my-3 h-px" style={{ background: "var(--line)" }} />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setDetail(true);
            }}
            className="flex h-9 w-full items-center justify-between rounded-md px-3 text-[13px] font-medium transition-colors"
            style={{ background: "var(--bg-sunken)", color: "var(--ink)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--line)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--bg-sunken)")
            }
          >
            View full profile
            <span aria-hidden style={{ fontSize: 12 }}>
              →
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
            className="mt-1.5 flex h-9 w-full items-center justify-center gap-2 rounded-md text-[13px] font-medium transition-colors"
            style={{ color: "var(--rose, #B83A3A)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background =
                "var(--rose-soft, #F7D9D9)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <span aria-hidden style={{ fontSize: 12 }}>
              ✕
            </span>
            Sign out
          </button>
        </div>
      )}

      {/* Full detail modal — Modal is portaled to document.body, so it
          naturally inherits the root (light) CSS-var palette regardless of
          which surface the trigger lives on. Profile detail stays light on
          every page (including the dark KDS header). */}
      <Modal
        isOpen={detail}
        onOpenChange={setDetail}
        className="sm:max-w-md"
      >
        <div
          className="flex items-center gap-4 border-b p-6"
          style={{ borderColor: "var(--line)" }}
        >
          <Avatar
            initials={initials(user.name)}
            size={56}
            tone={profile.tone}
          />
          <div className="min-w-0 flex-1">
            <div
              className="truncate text-[20px] font-semibold"
              style={{ letterSpacing: "-0.02em", color: "var(--ink)" }}
            >
              {user.name}
            </div>
            <div className="mt-1.5">
              <Tag tone={profile.tone}>{profile.roleLabel}</Tag>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setDetail(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            style={{
              background: "var(--bg-sunken)",
              color: "var(--ink-3)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--line)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--bg-sunken)")
            }
          >
            <span aria-hidden style={{ fontSize: 13 }}>
              ✕
            </span>
          </button>
        </div>

        <div className="p-6">
          {/* Big stat tiles */}
          <div className="mb-5 grid grid-cols-3 gap-2.5">
            {profile.stats.map((s) => (
              <div
                key={s.label}
                className="rounded-card px-2 py-3.5 text-center"
                style={{ background: "var(--bg-sunken)" }}
              >
                <div
                  className="tnum truncate text-[20px] font-semibold"
                  style={{ letterSpacing: "-0.025em", color: "var(--ink)" }}
                >
                  {s.value}
                </div>
                <div
                  className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "var(--ink-3)" }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div
            className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: "var(--ink-3)" }}
          >
            Details
          </div>
          {profile.details.map((d) => (
            <DetailRow key={d.label} {...d} />
          ))}

          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={() => setDetail(false)}
              className="h-10 flex-1 rounded-md border text-[13px] font-medium transition-colors"
              style={{
                borderColor: "var(--line-strong)",
                background: "var(--bg-elev)",
                color: "var(--ink)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--bg-sunken)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--bg-elev)")
              }
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                setDetail(false);
                void logout();
              }}
              className={cn(
                "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md text-[13px] font-semibold text-white hover:opacity-90",
                t.bg,
              )}
            >
              Sign out
              <span aria-hidden style={{ fontSize: 12 }}>
                →
              </span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
