import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, notFound, parseBody, serverError } from "@/lib/api";
import { shiftCloseSchema } from "@/lib/validation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, shiftCloseSchema);
    if (error) return error;

    const shift = await db.query.shifts.findFirst({
      where: eq(schema.shifts.id, id),
    });
    if (!shift) return notFound("Shift not found");
    if (shift.status === "closed") return badRequest("Shift is already closed");

    const [updated] = await db
      .update(schema.shifts)
      .set({
        status: "closed",
        closingAmount: data.closingAmount,
        note: data.note ?? shift.note,
        closedAt: new Date(),
      })
      .where(eq(schema.shifts.id, id))
      .returning();

    return Response.json({ shift: updated });
  } catch (err) {
    console.error("POST /api/shifts/[id]/close", err);
    return serverError();
  }
}
