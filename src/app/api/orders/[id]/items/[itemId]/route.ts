import { handleError, parseBody } from "@/lib/api";
import {
  orderItemDeleteSchema,
  orderItemUpdateSchema,
} from "@/lib/validation";
import { orderService } from "@/services/orders";

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id, itemId } = await params;
    const { data, error } = await parseBody(req, orderItemUpdateSchema);
    if (error) return error;

    const order = await orderService.updateItem(id, itemId, data, {
      originSocketId: req.headers.get("x-rms-socket-id"),
    });
    return Response.json({ order });
  } catch (err) {
    return handleError(err, "PATCH /api/orders/[id]/items/[itemId]");
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id, itemId } = await params;
    const { data, error } = await parseBody(req, orderItemDeleteSchema);
    if (error) return error;

    const order = await orderService.removeItem(id, itemId, {
      originSocketId: req.headers.get("x-rms-socket-id"),
    });
    return Response.json({ order, reason: data.reason });
  } catch (err) {
    return handleError(err, "DELETE /api/orders/[id]/items/[itemId]");
  }
}
