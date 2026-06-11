import { and, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, parseBody, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";
import { tableLayoutSchema } from "@/lib/validation";

/** Bulk-save floor plan layout for a branch's tables. */
export async function PUT(req: Request) {
  try {
    const { data, error } = await parseBody(req, tableLayoutSchema);
    if (error) return error;

    const timed = makeTimer(`layout PUT ${crypto.randomUUID().slice(0, 8)}`);

    const ids = data.tables.map((t) => t.id);
    const owned = await timed("select branch tables", () =>
      db.query.tables.findMany({
        where: and(
          eq(schema.tables.branchId, data.branchId),
          inArray(schema.tables.id, ids),
        ),
        columns: { id: true },
      }),
    );
    if (owned.length !== ids.length) {
      return badRequest("Some tables do not belong to this branch");
    }

    const zoneIds = [
      ...new Set(
        data.tables.flatMap((t) => (t.zoneId ? [t.zoneId] : [])),
      ),
    ];
    if (zoneIds.length > 0) {
      const zones = await timed("select zones", () =>
        db.query.floorZones.findMany({
          where: and(
            eq(schema.floorZones.branchId, data.branchId),
            inArray(schema.floorZones.id, zoneIds),
          ),
          columns: { id: true },
        }),
      );
      if (zones.length !== zoneIds.length) {
        return badRequest("Some zones do not belong to this branch");
      }
    }

    await timed("update layout", () =>
      db.transaction(async (tx) => {
        for (const t of data.tables) {
          await tx
            .update(schema.tables)
            .set({
              zoneId: t.zoneId,
              posX: t.posX,
              posY: t.posY,
              width: t.width,
              height: t.height,
              shape: t.shape,
              seats: t.seats,
              rotation: t.rotation,
            })
            .where(eq(schema.tables.id, t.id));
        }
      }),
    );

    const rows = await timed("reselect tables", () =>
      db.query.tables.findMany({
        where: eq(schema.tables.branchId, data.branchId),
      }),
    );
    return Response.json({ tables: rows });
  } catch (err) {
    console.error("PUT /api/tables/layout", err);
    return serverError();
  }
}
