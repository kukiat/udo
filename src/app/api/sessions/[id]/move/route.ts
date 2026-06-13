import { handleError, parseBody } from "@/lib/api";
import { sessionMoveSchema } from "@/lib/validation";
import { sessionService } from "@/services/sessions";

type Params = { params: Promise<{ id: string }> };

/**
 * Move an active table session — and every order in it — to another table in
 * the same branch. The bill follows automatically (it is keyed by session).
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, sessionMoveSchema);
    if (error) return error;

    const result = await sessionService.move(id, data, {
      originSocketId: req.headers.get("x-rms-socket-id"),
    });
    return Response.json(result);
  } catch (err) {
    return handleError(err, "POST /api/sessions/[id]/move");
  }
}
