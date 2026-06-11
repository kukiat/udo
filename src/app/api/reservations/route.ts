import { and, asc, desc, eq, gt, lt, ne } from "drizzle-orm";

import { db, schema } from "@/db";
import {
  badRequest,
  errorResponse,
  notFound,
  parseBody,
  parsePagination,
  serverError,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { reservationWith, toReservationDTO } from "@/lib/reservations";
import { RESERVATION_CONFLICT_MIN } from "@/lib/reservations-shared";
import { emitReservationUpdate } from "@/lib/socket";
import { makeTimer } from "@/lib/utils";
import { reservationCreateSchema } from "@/lib/validation";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    const tableId = searchParams.get("tableId");
    const filter = searchParams.get("filter") ?? "upcoming";
    if (!branchId && !tableId)
      return badRequest("branchId or tableId is required");

    const { limit, offset } = parsePagination(searchParams);
    const timed = makeTimer(
      `reservations GET ${crypto.randomUUID().slice(0, 8)}`,
    );

    const scope = and(
      branchId ? eq(schema.reservations.branchId, branchId) : undefined,
      tableId ? eq(schema.reservations.tableId, tableId) : undefined,
    );
    // upcoming = still booked; past = settled (seated/cancelled/no_show)
    const where =
      filter === "upcoming"
        ? and(scope, eq(schema.reservations.status, "booked"))
        : filter === "past"
          ? and(scope, ne(schema.reservations.status, "booked"))
          : scope;

    const rows = await timed("select reservations", () =>
      db.query.reservations.findMany({
        where,
        with: reservationWith,
        orderBy:
          filter === "upcoming"
            ? [asc(schema.reservations.reservedFor)]
            : [desc(schema.reservations.reservedFor)],
        limit,
        offset,
      }),
    );

    return Response.json({ reservations: rows.map(toReservationDTO) });
  } catch (err) {
    console.error("GET /api/reservations", err);
    return serverError();
  }
}

export async function POST(req: Request) {
  try {
    const scope = `reservations POST ${crypto.randomUUID().slice(0, 8)}`;
    const timed = makeTimer(scope);

    const user = await timed("get current user", () => getCurrentUser());
    if (!user) return errorResponse("UNAUTHORIZED", "Not signed in", 401);

    const { data, error } = await parseBody(req, reservationCreateSchema);
    if (error) return error;

    const table = await timed("select table", () =>
      db.query.tables.findFirst({
        where: and(
          eq(schema.tables.id, data.tableId),
          eq(schema.tables.branchId, data.branchId),
        ),
      }),
    );
    if (!table) return notFound("Table not found");

    // Reject a second booking too close to an existing one on the same table.
    const windowMs = RESERVATION_CONFLICT_MIN * 60_000;
    const conflict = await timed("check conflict", () =>
      db.query.reservations.findFirst({
        where: and(
          eq(schema.reservations.tableId, data.tableId),
          eq(schema.reservations.status, "booked"),
          gt(
            schema.reservations.reservedFor,
            new Date(data.reservedFor.getTime() - windowMs),
          ),
          lt(
            schema.reservations.reservedFor,
            new Date(data.reservedFor.getTime() + windowMs),
          ),
        ),
      }),
    );
    if (conflict) {
      return badRequest(
        `Table ${table.tableNumber} already has a reservation around that time (bookings must be ${RESERVATION_CONFLICT_MIN} min apart)`,
        {
          conflictReservationId: conflict.id,
          reservedFor: conflict.reservedFor.toISOString(),
        },
      );
    }

    const [created] = await timed("insert reservation", () =>
      db
        .insert(schema.reservations)
        .values({
          branchId: data.branchId,
          tableId: data.tableId,
          reservedById: user.id,
          customerName: data.customerName,
          customerPhone: data.customerPhone || null,
          partySize: data.partySize,
          note: data.note || null,
          reservedFor: data.reservedFor,
        })
        .returning(),
    );

    emitReservationUpdate(data.branchId);

    return Response.json(
      {
        reservation: toReservationDTO({
          ...created,
          table: { id: table.id, tableNumber: table.tableNumber },
          reservedBy: { id: user.id, name: user.name },
        }),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/reservations", err);
    return serverError();
  }
}
