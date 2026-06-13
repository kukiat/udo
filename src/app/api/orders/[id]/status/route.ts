import { handleError, parseBody } from "@/lib/api";
import { orderStatusSchema } from "@/lib/validation";
import { orderService } from "@/services/orders";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(req, orderStatusSchema);
    if (error) return error;

    const order = await orderService.transition(id, data.status, {
      originSocketId: req.headers.get("x-rms-socket-id"),
    });
    return Response.json({ order });
  } catch (err) {
    return handleError(err, "PATCH /api/orders/[id]/status");
  }
}
