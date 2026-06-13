import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { makeTimer } from "@/lib/utils";
import type { ZoneCreateInput, ZoneUpdateInput } from "@/lib/validation";
import { ServiceError } from "@/services/errors";

export class FloorService {
  async listZones(branchId: string) {
    const timed = makeTimer(`zones GET ${crypto.randomUUID().slice(0, 8)}`);
    return timed("select zones", () =>
      db.query.floorZones.findMany({
        where: eq(schema.floorZones.branchId, branchId),
        orderBy: [asc(schema.floorZones.sortOrder), asc(schema.floorZones.name)],
      }),
    );
  }

  async createZone(input: ZoneCreateInput) {
    const timed = makeTimer(`zones POST ${crypto.randomUUID().slice(0, 8)}`);
    const [created] = await timed("insert zone", () =>
      db
        .insert(schema.floorZones)
        .values({
          branchId: input.branchId,
          name: input.name,
          sortOrder: input.sortOrder ?? 0,
        })
        .returning(),
    );
    return created;
  }

  async updateZone(id: string, input: ZoneUpdateInput) {
    const timed = makeTimer(
      `zone PUT ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );
    const [updated] = await timed("update zone", () =>
      db
        .update(schema.floorZones)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        })
        .where(eq(schema.floorZones.id, id))
        .returning(),
    );
    if (!updated) throw new ServiceError("NOT_FOUND", "Zone not found", 404);
    return updated;
  }

  async deleteZone(id: string) {
    const timed = makeTimer(
      `zone DELETE ${id.slice(0, 8)} ${crypto.randomUUID().slice(0, 8)}`,
    );
    // Tables reference zones with onDelete: set null — they fall back to the
    // "unplaced" tray rather than being deleted.
    const [deleted] = await timed("delete zone", () =>
      db.delete(schema.floorZones).where(eq(schema.floorZones.id, id)).returning(),
    );
    if (!deleted) throw new ServiceError("NOT_FOUND", "Zone not found", 404);
  }
}

export const floorService = new FloorService();
