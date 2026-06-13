import { handleError, parseBody } from "@/lib/api";
import { sessionCancelSchema } from "@/lib/validation";
import { sessionService } from "@/services/sessions";

type Params = { params: Promise<{ id: string }> };

/**
 * Cancel a table session without payment — for tables opened by mistake or
 * guests who left before ordering. Pending/preparing orders are cancelled with
 * the session; once any order is ready/served/completed the table must be
 * settled through POS instead.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, sessionCancelSchema);
    if (error) return error;

    const result = await sessionService.cancel(id, data.reason ?? null, {
      originSocketId: req.headers.get("x-rms-socket-id"),
    });
    return Response.json(result);
  } catch (err) {
    return handleError(err, "POST /api/sessions/[id]/cancel");
  }
}
