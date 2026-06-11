import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { badRequest, parseBody, serverError } from "@/lib/api";
import { makeTimer } from "@/lib/utils";
import { zoneCreateSchema } from "@/lib/validation";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const timed = makeTimer(`zones GET ${crypto.randomUUID().slice(0, 8)}`);
    const rows = await timed("select zones", () =>
      db.query.floorZones.findMany({
        where: eq(schema.floorZones.branchId, branchId),
        orderBy: [asc(schema.floorZones.sortOrder), asc(schema.floorZones.name)],
      }),
    );
    return Response.json({ zones: rows });
  } catch (err) {
    console.error("GET /api/floor-zones", err);
    return serverError();
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, zoneCreateSchema);
    if (error) return error;

    const timed = makeTimer(`zones POST ${crypto.randomUUID().slice(0, 8)}`);
    const [created] = await timed("insert zone", () =>
      db
        .insert(schema.floorZones)
        .values({
          branchId: data.branchId,
          name: data.name,
          sortOrder: data.sortOrder ?? 0,
        })
        .returning(),
    );
    return Response.json({ zone: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/floor-zones", err);
    return serverError();
  }
}
