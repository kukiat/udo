import {
  badRequest,
  errorResponse,
  handleError,
  parseBody,
  parsePagination,
} from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { reservationCreateSchema } from "@/lib/validation";
import { createReservation, listReservations } from "@/services/reservations";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    const tableId = searchParams.get("tableId");
    if (!branchId && !tableId) {
      return badRequest("branchId or tableId is required");
    }

    // Optional reservedFor window (e.g. the calendar fetches one month at a
    // time): from = inclusive start, to = exclusive end.
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const from = fromParam ? new Date(fromParam) : null;
    const to = toParam ? new Date(toParam) : null;
    if (from && Number.isNaN(from.getTime())) {
      return badRequest("from must be a valid date");
    }
    if (to && Number.isNaN(to.getTime())) {
      return badRequest("to must be a valid date");
    }

    const { limit, offset } = parsePagination(searchParams);
    const reservations = await listReservations({
      branchId,
      tableId,
      filter: searchParams.get("filter") ?? "upcoming",
      from,
      to,
      limit,
      offset,
    });
    return Response.json({ reservations });
  } catch (err) {
    return handleError(err, "GET /api/reservations");
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return errorResponse("UNAUTHORIZED", "Not signed in", 401);

    const { data, error } = await parseBody(req, reservationCreateSchema);
    if (error) return error;

    const reservation = await createReservation(data, user);
    return Response.json({ reservation }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/reservations");
  }
}
