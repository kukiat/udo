"use client";

import {
  Button,
  Header,
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Section,
} from "react-aria-components";

import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/cn";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  branch_manager: "Branch Manager",
  cashier: "Cashier",
  kitchen_staff: "Kitchen Staff",
  waitstaff: "Waitstaff",
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

// Dropdown showing the signed-in account with a sign-out action. Pulls the
// current user from AuthContext, so it renders nothing while logged out.
// The `dark` variant matches the Neon Diner dashboard theme; since the popover
// portals outside the `.dir-a` scope, its colors are spelled out explicitly.
export function AccountMenu({
  className,
  dark = false,
}: {
  className?: string;
  dark?: boolean;
}) {
  const { user, logout } = useAuth();
  if (!user) return null;

  const triggerClass = dark
    ? cn(
        "inline-flex items-center gap-2 rounded-full border border-[oklch(0.34_0.025_270)] bg-[oklch(0.21_0.02_270)] px-2.5 py-1.5 text-sm outline-none",
        "hover:bg-[oklch(0.28_0.022_270)] focus-visible:ring-2 focus-visible:ring-[oklch(0.72_0.21_28)]",
        className,
      )
    : cn(
        "inline-flex items-center gap-2 rounded-xl border border-line bg-white px-2.5 py-1.5 text-sm outline-none",
        "hover:bg-sand focus-visible:ring-2 focus-visible:ring-clay-300",
        className,
      );
  const avatarClass = dark
    ? "flex h-7 w-7 items-center justify-center rounded-full border border-[oklch(0.72_0.21_28)] bg-[oklch(0.45_0.12_28)] text-xs font-semibold text-[oklch(0.72_0.21_28)]"
    : "flex h-7 w-7 items-center justify-center rounded-full bg-clay-100 text-xs font-semibold text-clay-700";
  const nameClass = dark
    ? "hidden max-w-[10rem] truncate text-left font-medium text-[oklch(0.97_0.005_90)] sm:block"
    : "hidden max-w-[10rem] truncate text-left font-medium text-ink sm:block";
  const caretClass = dark ? "opacity-60" : "text-ink-muted";
  const popoverClass = dark
    ? "w-60 rounded-2xl border border-[oklch(0.34_0.025_270)] bg-[oklch(0.21_0.02_270)] shadow-xl outline-none entering:animate-in entering:fade-in"
    : "w-60 rounded-xl border border-line bg-white shadow-card outline-none entering:animate-in entering:fade-in";
  const userNameClass = dark
    ? "truncate text-sm font-semibold text-[oklch(0.97_0.005_90)]"
    : "truncate text-sm font-semibold text-ink";
  const emailClass = dark
    ? "truncate text-xs text-[oklch(0.6_0.01_270)]"
    : "truncate text-xs text-ink-muted";
  const roleClass = dark
    ? "mt-1.5 inline-flex items-center rounded-full bg-[oklch(0.28_0.022_270)] px-2 py-0.5 text-xs font-medium text-[oklch(0.78_0.01_270)]"
    : "mt-1.5 inline-flex items-center rounded-full bg-sand px-2 py-0.5 text-xs font-medium text-ink-soft";
  const signOutClass = dark
    ? "mt-1 cursor-pointer rounded-xl border-t border-[oklch(0.34_0.025_270)] px-3 py-2 text-sm text-[oklch(0.75_0.16_18)] outline-none focus:bg-[oklch(0.3_0.12_18)]"
    : "mt-1 cursor-pointer rounded-lg border-t border-line px-3 py-2 text-sm text-red-600 outline-none focus:bg-red-50";

  return (
    <MenuTrigger>
      <Button aria-label="Account menu" className={triggerClass}>
        <span className={avatarClass}>{initials(user.name)}</span>
        <span className={nameClass}>{user.name}</span>
        <span aria-hidden className={caretClass}>
          ▾
        </span>
      </Button>
      <Popover placement="bottom end" className={popoverClass}>
        <Menu className="p-1 outline-none">
          <Section>
            <Header className="px-3 py-2">
              <p className={userNameClass}>{user.name}</p>
              <p className={emailClass}>{user.email}</p>
              <span className={roleClass}>
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </Header>
          </Section>
          <MenuItem onAction={() => logout()} className={signOutClass}>
            Sign out
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
