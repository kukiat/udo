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
export function AccountMenu({ className }: { className?: string }) {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <MenuTrigger>
      <Button
        aria-label="Account menu"
        className={cn(
          "inline-flex items-center gap-2 rounded-xl border border-line bg-white px-2.5 py-1.5 text-sm outline-none",
          "hover:bg-sand focus-visible:ring-2 focus-visible:ring-clay-300",
          className,
        )}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-clay-100 text-xs font-semibold text-clay-700">
          {initials(user.name)}
        </span>
        <span className="hidden max-w-[10rem] truncate text-left font-medium text-ink sm:block">
          {user.name}
        </span>
        <span aria-hidden className="text-ink-muted">
          ▾
        </span>
      </Button>
      <Popover
        placement="bottom end"
        className="w-60 rounded-xl border border-line bg-white shadow-card outline-none entering:animate-in entering:fade-in"
      >
        <Menu className="p-1 outline-none">
          <Section>
            <Header className="px-3 py-2">
              <p className="truncate text-sm font-semibold text-ink">
                {user.name}
              </p>
              <p className="truncate text-xs text-ink-muted">{user.email}</p>
              <span className="mt-1.5 inline-flex items-center rounded-full bg-sand px-2 py-0.5 text-xs font-medium text-ink-soft">
                {ROLE_LABEL[user.role] ?? user.role}
              </span>
            </Header>
          </Section>
          <MenuItem
            onAction={() => logout()}
            className="mt-1 cursor-pointer rounded-lg border-t border-line px-3 py-2 text-sm text-red-600 outline-none focus:bg-red-50"
          >
            Sign out
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
