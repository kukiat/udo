import { and, desc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import {
  badRequest,
  errorResponse,
  parseBody,
  serverError,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { makeTimer } from "@/lib/utils";
import { shiftOpenSchema } from "@/lib/validation";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    const status = searchParams.get("status");
    if (!branchId) return badRequest("branchId is required");

    const timed = makeTimer(`shifts GET ${crypto.randomUUID().slice(0, 8)}`);

    const where =
      status === "open" || status === "closed"
        ? and(
            eq(schema.shifts.branchId, branchId),
            eq(schema.shifts.status, status),
          )
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

    const shifts = rows.map((s) => {
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

    return Response.json({ shifts });
  } catch (err) {
    console.error("GET /api/shifts", err);
    return serverError();
  }
}

export async function POST(req: Request) {
  try {
    const scope = `shifts POST ${crypto.randomUUID().slice(0, 8)}`;
    const timed = makeTimer(scope);

    const user = await timed("get current user", () => getCurrentUser());
    if (!user) return errorResponse("UNAUTHORIZED", "Not signed in", 401);

    const { data, error } = await parseBody(req, shiftOpenSchema);
    if (error) return error;

    // One open shift per cashier per branch — return the existing one if any.
    const existing = await timed("select open shift", () =>
      db.query.shifts.findFirst({
        where: and(
          eq(schema.shifts.branchId, data.branchId),
          eq(schema.shifts.cashierId, user.id),
          eq(schema.shifts.status, "open"),
        ),
      }),
    );
    if (existing) return Response.json({ shift: existing });

    const [shift] = await timed("insert shift", () =>
      db
        .insert(schema.shifts)
        .values({
          branchId: data.branchId,
          cashierId: user.id,
          openingFloat: data.openingFloat,
          note: data.note ?? null,
        })
        .returning(),
    );

    return Response.json({ shift }, { status: 201 });
  } catch (err) {
    console.error("POST /api/shifts", err);
    return serverError();
  }
}
