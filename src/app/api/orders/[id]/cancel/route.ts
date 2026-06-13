import { handleError, parseBody } from "@/lib/api";
import { orderCancelSchema } from "@/lib/validation";
import { orderService } from "@/services/orders";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, orderCancelSchema);
    if (error) return error;

    const order = await orderService.cancel(id, data.reason ?? null, {
      originSocketId: req.headers.get("x-rms-socket-id"),
    });
    return Response.json({ order });
  } catch (err) {
    return handleError(err, "POST /api/orders/[id]/cancel");
  }
}
