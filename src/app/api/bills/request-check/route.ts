import { handleError, parseBody } from "@/lib/api";
import { billRequestSchema } from "@/lib/validation";
import { requestCheck } from "@/services/bills";

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, billRequestSchema);
    if (error) return error;

    const bill = await requestCheck(data.sessionId);
    return Response.json({ bill });
  } catch (err) {
    return handleError(err, "POST /api/bills/request-check");
  }
}
