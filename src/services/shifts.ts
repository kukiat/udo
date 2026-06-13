import { and, desc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import type { AuthUser } from "@/lib/auth";
import { makeTimer } from "@/lib/utils";
import type { ShiftCloseInput, ShiftOpenInput } from "@/lib/validation";
import { ServiceError } from "@/services/errors";

export class ShiftService {
  /** Shifts for a branch (optionally filtered by status) with payment/cash totals. */
  async list(branchId: string, status: string | null) {
    const timed = makeTimer(`shifts GET ${crypto.randomUUID().slice(0, 8)}`);

    const where =
      status === "open" || status === "closed"
        ? and(eq(schema.shifts.branchId, branchId), eq(schema.shifts.status, status))
        : eq(schema.shifts.branchId, branchId);

    const rows = await timed("select shifts", () =>
      db.query.shifts.findMany({
        where,
        orderBy: [desc(schema.shifts.openedAt)],
        with: {
          cashier: { columns: { id: true, name: true } },
          payments: { columns: { method: true, amount: true } },
        },
      }),
    );

    return rows.map((s) => {
      const cashTotal = s.payments
        .filter((p) => p.method === "cash")
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const total = s.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      return {
        id: s.id,
        branchId: s.branchId,
        cashierId: s.cashier.id,
        cashierName: s.cashier.name,
        status: s.status,
        openingFloat: s.openingFloat,
        closingAmount: s.closingAmount,
        note: s.note,
        openedAt: s.openedAt.toISOString(),
        closedAt: s.closedAt?.toISOString() ?? null,
        paymentCount: s.payments.length,
        cashTotal: cashTotal.toFixed(2),
        salesTotal: total.toFixed(2),
        expectedCash: (parseFloat(s.openingFloat) + cashTotal).toFixed(2),
      };
    });
  }

  /**
   * Open a shift for the cashier at a branch. Idempotent: returns the existing
   * open shift if one is already open for this cashier+branch (`created: false`).
   */
  async open(input: ShiftOpenInput, user: AuthUser) {
    const timed = makeTimer(`shifts POST ${crypto.randomUUID().slice(0, 8)}`);

    const existing = await timed("select open shift", () =>
      db.query.shifts.findFirst({
        where: and(
          eq(schema.shifts.branchId, input.branchId),
          eq(schema.shifts.cashierId, user.id),
          eq(schema.shifts.status, "open"),
        ),
      }),
    );
    if (existing) return { shift: existing, created: false };

    const [shift] = await timed("insert shift", () =>
      db
        .insert(schema.shifts)
        .values({
          branchId: input.branchId,
          cashierId: user.id,
          openingFloat: input.openingFloat,
          note: input.note ?? null,
        })
        .returning(),
    );

    return { shift, created: true };
  }

  /** Close a shift, recording the counted drawer cash. */
  async close(id: string, input: ShiftCloseInput) {
    const timed = makeTimer(
      `shift-close POST ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );

    const shift = await timed("select shift", () =>
      db.query.shifts.findFirst({ where: eq(schema.shifts.id, id) }),
    );
    if (!shift) throw new ServiceError("NOT_FOUND", "Shift not found", 404);
    if (shift.status === "closed") {
      throw new ServiceError("BAD_REQUEST", "Shift is already closed", 400);
    }

    const [updated] = await timed("update shift closed", () =>
      db
        .update(schema.shifts)
        .set({
          status: "closed",
          closingAmount: input.closingAmount,
          note: input.note ?? shift.note,
          closedAt: new Date(),
        })
        .where(eq(schema.shifts.id, id))
        .returning(),
    );

    return updated;
  }
}

export const shiftService = new ShiftService();
