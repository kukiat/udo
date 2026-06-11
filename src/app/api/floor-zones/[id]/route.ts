import { eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { notFound, parseBody, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";
import { zoneUpdateSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, zoneUpdateSchema);
    if (error) return error;

    const timed = makeTimer(
      `zone PUT ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );
    const [updated] = await timed("update zone", () =>
      db
        .update(schema.floorZones)
        .set({
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.sortOrder !== undefined
            ? { sortOrder: data.sortOrder }
            : {}),
        })
        .where(eq(schema.floorZones.id, id))
        .returning(),
    );
    if (!updated) return notFound("Zone not found");
    return Response.json({ zone: updated });
  } catch (err) {
    console.error("PUT /api/floor-zones/[id]", err);
    return serverError();
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;

    const timed = makeTimer(
      `zone DELETE ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );
    // Tables reference zones with onDelete: set null — they fall back to the
    // "unplaced" tray rather than being deleted.
    const [deleted] = await timed("delete zone", () =>
      db
        .delete(schema.floorZones)
        .where(eq(schema.floorZones.id, id))
        .returning(),
    );
    if (!deleted) return notFound("Zone not found");
    return Response.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/floor-zones/[id]", err);
    return serverError();
  }
}
