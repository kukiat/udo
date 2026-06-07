import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const timed = makeTimer(
      `kds-stations GET ${crypto.randomUUID().slice(0, 8)}`,
    );
    const stations = await timed("select kds stations", () =>
      db.query.kdsStations.findMany({
        where: eq(schema.kdsStations.branchId, branchId),
        orderBy: [asc(schema.kdsStations.sortOrder)],
      }),
    );
    return Response.json({ stations });
  } catch (err) {
    console.error("GET /api/kds-stations", err);
    return serverError();
  }
}
