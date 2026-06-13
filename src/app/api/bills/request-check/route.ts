import { handleError, parseBody } from "@/lib/api";
import { billRequestSchema } from "@/lib/validation";
import { billService } from "@/services/bills";

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, billRequestSchema);
    if (error) return error;

    const bill = await billService.requestCheck(data.sessionId);
    return Response.json({ bill });
  } catch (err) {
    return handleError(err, "POST /api/bills/request-check");
  }
}
