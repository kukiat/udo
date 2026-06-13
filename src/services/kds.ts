import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { makeTimer } from "@/lib/utils";

export class KdsService {
  /** KDS stations for a branch, ordered by sortOrder. */
  async listStations(branchId: string) {
    const timed = makeTimer(`kds-stations GET ${crypto.randomUUID().slice(0, 8)}`);
    return timed("select kds stations", () =>
      db.query.kdsStations.findMany({
        where: eq(schema.kdsStations.branchId, branchId),
        orderBy: [asc(schema.kdsStations.sortOrder)],
      }),
    );
  }
}

export const kdsService = new KdsService();
