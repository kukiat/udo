import { handleError, parseBody } from "@/lib/api";
import { reservationCancelSchema } from "@/lib/validation";
import { reservationService } from "@/services/reservations";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, reservationCancelSchema);
    if (error) return error;

    const reservation = await reservationService.cancel(id, data);
    return Response.json({ reservation });
  } catch (err) {
    return handleError(err, "POST /api/reservations/[id]/cancel");
  }
}
