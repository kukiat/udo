"use client";

import {
  Button as AriaButton,
  ListBox,
  ListBoxItem,
  Popover,
  Select as AriaSelect,
} from "react-aria-components";

import { AccountMenu } from "@/components/ui/AccountMenu";
import { Select } from "@/components/ui/Select";
import { useRestaurant } from "@/contexts/RestaurantContext";

function initials(name?: string | null): string {
  if (!name) return "R";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "R"
  );
}

// Marrow brand mark: ink ring with a coral inner dot, followed by the
// "Marrow" wordmark. Matches the design's BrandMark primitive.
function MarrowBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative inline-block h-5 w-5 rounded-full bg-ink">
        <span className="absolute inset-[20%] rounded-full bg-clay-500" />
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
        Marrow
      </span>
    </div>
  );
}

const VDivider = () => (
  <span aria-hidden className="h-[18px] w-px bg-line-strong/70" />
);

// Marrow topbar — used across modules. Layout mirrors the design's TopBar:
// brand · divider · role · (divider · left slot) — — right slot · (divider) · account.
export function TopBar({
  role,
  left,
  right,
  showLive = true,
  liveLabel = "Live",
}: {
  role?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  showLive?: boolean;
  liveLabel?: string;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-white px-5 sm:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <MarrowBrand />
        {role && (
          <>
            <VDivider />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              {role}
            </span>
          </>
        )}
        {left && (
          <>
            <VDivider />
            <div className="min-w-0">{left}</div>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        {right}
        {showLive && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-olive-soft px-2.5 py-[3px] text-[11px] font-medium text-olive">
            <span className="h-1.5 w-1.5 animate-marrow-blink rounded-full bg-olive" />
            {liveLabel}
          </span>
        )}
        <VDivider />
        <AccountMenu />
      </div>
    </header>
  );
}

// Green-bordered pill that doubles as a branch picker. Avatar bubble + name +
// caret; clicking opens a dropdown with the rest of the branches.
export function BranchPill({
  branches,
  branchId,
  onChange,
}: {
  branches: { id: string; name: string }[];
  branchId: string | null;
  onChange: (id: string) => void;
}) {
  const current = branches.find((b) => b.id === branchId) ?? branches[0];
  if (!current) return null;
  return (
    <AriaSelect
      selectedKey={current.id}
      onSelectionChange={(k) => k && onChange(String(k))}
    >
      <AriaButton
        aria-label="Switch branch"
        className="inline-flex items-center gap-2 rounded-full border border-olive/40 bg-olive-soft/60 py-1 pl-1 pr-3 text-sm text-olive outline-none hover:bg-olive-soft focus-visible:ring-2 focus-visible:ring-olive/30"
      >
        <span className="mono flex h-6 w-6 items-center justify-center rounded-full border border-olive/40 bg-white text-[10px] font-semibold text-olive">
          {initials(current.name)}
        </span>
        <span className="font-medium text-ink">{current.name}</span>
        <span aria-hidden className="opacity-60">
          ▾
        </span>
      </AriaButton>
      <Popover className="w-[--trigger-width] min-w-[12rem] overflow-auto rounded-xl border border-line bg-white shadow-card entering:animate-in entering:fade-in">
        <ListBox className="p-1 outline-none">
          {branches.map((b) => (
            <ListBoxItem
              key={b.id}
              id={b.id}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm text-ink outline-none selected:bg-olive-soft selected:font-semibold selected:text-olive focus:bg-sand"
            >
              {b.name}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </AriaSelect>
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

// Per-restaurant topbar — Marrow design. Role label shows the restaurant +
// "MANAGEMENT"; the branch pill lives on the right as in the design.
export function RestaurantTopBar() {
  const { restaurantName, branches, branchId, setBranch } = useRestaurant();
  return (
    <TopBar
      role={restaurantName ? `${restaurantName} · MANAGEMENT` : "MANAGEMENT"}
      right={
        branches.length > 0 ? (
          <BranchPill
            branches={branches}
            branchId={branchId}
            onChange={setBranch}
          />
        ) : null
      }
    />
  );
}

// Re-exported so older imports that pull `Select` via TopBar keep working.
export { Select };
