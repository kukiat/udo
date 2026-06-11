"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";

import { cn } from "@/lib/cn";
import type { TableLayoutDTO } from "@/types";

import { TableNode } from "./TableNode";

export const CANVAS_W = 1000;
export const CANVAS_H = 600;
export const GRID = 20;

const snap = (v: number) => Math.round(v / GRID) * GRID;
const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

type LayoutPatch = Partial<
  Pick<TableLayoutDTO, "posX" | "posY" | "width" | "height" | "rotation">
>;

type DragState = {
  id: string;
  kind: "move" | "resize" | "rotate";
  startX: number;
  startY: number;
  orig: { posX: number; posY: number; width: number; height: number; rotation: number };
  moved: boolean;
};

type Props = {
  /** Placed tables of the active zone (posX/posY non-null). */
  tables: TableLayoutDTO[];
  mode: "edit" | "view";
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Edit mode only — live layout updates while dragging. */
  onChange?: (id: string, patch: LayoutPatch) => void;
  /** Status badges etc. layered on a table (waitstaff view). */
  renderOverlay?: (table: TableLayoutDTO) => React.ReactNode;
  className?: string;
};

export function FloorPlanCanvas({
  tables,
  mode,
  selectedId,
  onSelect,
  onChange,
  renderOverlay,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const dragRef = useRef<DragState | null>(null);
  // Re-read latest table data during a drag without re-binding handlers.
  const tablesRef = useRef(tables);
  tablesRef.current = tables;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / CANVAS_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    // Fallback: ResizeObserver delivery can be throttled in background /
    // headless windows; a plain resize listener keeps the scale honest.
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const beginDrag = (
    e: React.PointerEvent,
    id: string,
    kind: DragState["kind"],
  ) => {
    if (mode !== "edit") return;
    const t = tablesRef.current.find((x) => x.id === id);
    if (!t || t.posX == null || t.posY == null) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(id);
    dragRef.current = {
      id,
      kind,
      startX: e.clientX,
      startY: e.clientY,
      orig: {
        posX: t.posX,
        posY: t.posY,
        width: t.width,
        height: t.height,
        rotation: t.rotation,
      },
      moved: false,
    };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || scale <= 0) return;
    const dx = (e.clientX - drag.startX) / scale;
    const dy = (e.clientY - drag.startY) / scale;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;

    if (drag.kind === "move") {
      onChange?.(drag.id, {
        posX: clamp(snap(drag.orig.posX + dx), 0, CANVAS_W - drag.orig.width),
        posY: clamp(snap(drag.orig.posY + dy), 0, CANVAS_H - drag.orig.height),
      });
    } else if (drag.kind === "resize") {
      // Project the pointer delta onto the table's rotated axes so the
      // corner handle behaves naturally at any rotation.
      const rad = (drag.orig.rotation * Math.PI) / 180;
      const du = dx * Math.cos(rad) + dy * Math.sin(rad);
      const dv = -dx * Math.sin(rad) + dy * Math.cos(rad);
      onChange?.(drag.id, {
        width: clamp(
          snap(drag.orig.width + du),
          40,
          Math.min(400, CANVAS_W - drag.orig.posX),
        ),
        height: clamp(
          snap(drag.orig.height + dv),
          40,
          Math.min(400, CANVAS_H - drag.orig.posY),
        ),
      });
    } else {
      // Angle from the table center to the pointer; the knob sits above the
      // top edge, so straight up = 0°. Snap to 15° steps.
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + (drag.orig.posX + drag.orig.width / 2) * scale;
      const cy = rect.top + (drag.orig.posY + drag.orig.height / 2) * scale;
      const deg =
        (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
      const snapped = Math.round(deg / 15) * 15;
      onChange?.(drag.id, { rotation: ((snapped % 360) + 360) % 360 });
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    containerRef.current?.releasePointerCapture(e.pointerId);
    dragRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerDown={(e) => {
        // Clicking empty canvas clears the selection.
        if (e.target === e.currentTarget) onSelect?.(null);
      }}
      className={cn(
        "relative w-full overflow-hidden rounded-card border border-line bg-sand",
        className,
      )}
      style={{
        aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
        backgroundImage:
          mode === "edit"
            ? "linear-gradient(to right, var(--line, #E7E3D9) 1px, transparent 1px), linear-gradient(to bottom, var(--line, #E7E3D9) 1px, transparent 1px)"
            : undefined,
        backgroundSize:
          mode === "edit"
            ? `${GRID * scale}px ${GRID * scale}px`
            : undefined,
      }}
    >
      {scale > 0 &&
        tables.map((t) => (
          <TableNode
            key={t.id}
            table={t}
            scale={scale}
            mode={mode}
            selected={selectedId === t.id}
            overlay={renderOverlay?.(t)}
            onBodyPointerDown={(e) => beginDrag(e, t.id, "move")}
            onResizePointerDown={(e) => beginDrag(e, t.id, "resize")}
            onRotatePointerDown={(e) => beginDrag(e, t.id, "rotate")}
            onClick={() => {
              if (mode === "view") onSelect?.(t.id);
            }}
          />
        ))}
    </div>
  );
}
