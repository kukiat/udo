"use client";

import type React from "react";

import { cn } from "@/lib/cn";
import type { TableLayoutDTO } from "@/types";

type Props = {
  table: TableLayoutDTO;
  scale: number;
  mode: "edit" | "view";
  selected?: boolean;
  /** Extra content layered on top (status badges etc. — waitstaff view). */
  overlay?: React.ReactNode;
  onBodyPointerDown?: (e: React.PointerEvent) => void;
  onResizePointerDown?: (e: React.PointerEvent) => void;
  onRotatePointerDown?: (e: React.PointerEvent) => void;
  onClick?: () => void;
};

export function TableNode({
  table,
  scale,
  mode,
  selected,
  overlay,
  onBodyPointerDown,
  onResizePointerDown,
  onRotatePointerDown,
  onClick,
}: Props) {
  if (table.posX == null || table.posY == null) return null;

  const w = table.width * scale;
  const h = table.height * scale;
  const compact = Math.min(w, h) < 56;

  return (
    <div
      className="absolute"
      style={{
        left: table.posX * scale,
        top: table.posY * scale,
        width: w,
        height: h,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`Table ${table.tableNumber}`}
        onPointerDown={onBodyPointerDown}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
        className={cn(
          "relative flex h-full w-full select-none flex-col items-center justify-center border outline-none transition-shadow",
          table.shape === "circle" ? "rounded-full" : "rounded-card",
          table.status === "occupied"
            ? "border-amber/50 bg-amber-soft"
            : table.status === "reserved"
              ? "border-blue-300 bg-blue-50"
              : "border-olive/40 bg-olive-soft",
          selected && "ring-2 ring-clay-500 shadow-elev",
          mode === "edit" ? "cursor-move" : "cursor-pointer",
          "focus-visible:ring-2 focus-visible:ring-clay-300",
        )}
        style={{
          transform: `rotate(${table.rotation}deg)`,
          touchAction: "none",
        }}
      >
        <span
          className="font-semibold leading-none text-ink"
          style={{ fontSize: compact ? 11 : Math.max(12, 14 * scale + 6) }}
        >
          {table.tableNumber}
        </span>
        {!compact && (
          <span className="mt-0.5 text-[10px] leading-none text-ink-muted">
            {table.seats} seats
          </span>
        )}

        {mode === "edit" && selected && (
          <>
            {/* Rotate handle — stem + knob above the top edge. */}
            <div
              className="absolute left-1/2 -translate-x-1/2"
              style={{ top: -22 }}
            >
              <div className="mx-auto h-2.5 w-px bg-clay-500" />
              <div
                onPointerDown={onRotatePointerDown}
                className="h-3.5 w-3.5 cursor-grab rounded-full border-2 border-clay-500 bg-white"
                style={{ touchAction: "none" }}
              />
            </div>
            {/* Resize handle — bottom-right corner. */}
            <div
              onPointerDown={onResizePointerDown}
              className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize rounded-sm border-2 border-clay-500 bg-white"
              style={{ touchAction: "none" }}
            />
          </>
        )}
      </div>

      {overlay && (
        <div className="pointer-events-none absolute inset-0">{overlay}</div>
      )}
    </div>
  );
}
