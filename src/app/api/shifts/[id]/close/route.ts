import { handleError, parseBody } from "@/lib/api";
import { shiftCloseSchema } from "@/lib/validation";
import { closeShift } from "@/services/shifts";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, shiftCloseSchema);
    if (error) return error;

    const shift = await closeShift(id, data);
    return Response.json({ shift });
  } catch (err) {
    return handleError(err, "POST /api/shifts/[id]/close");
  }
}
