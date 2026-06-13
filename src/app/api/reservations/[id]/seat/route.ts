import { handleError, parseBody } from "@/lib/api";
import { reservationSeatSchema } from "@/lib/validation";
import { reservationService } from "@/services/reservations";

type Params = { params: Promise<{ id: string }> };

/**
 * Seat a booked reservation: opens a table session seeded from the
 * reservation (overridable via the body) and marks the table occupied.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, reservationSeatSchema);
    if (error) return error;

    const result = await reservationService.seat(id, data);
    return Response.json(result, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/reservations/[id]/seat");
  }
}
