import { badRequest, handleError, parseBody } from "@/lib/api";
import { orderCreateSchema } from "@/lib/validation";
import { listOrders, placeOrder } from "@/services/orders";
import type { OrderStatus } from "@/types";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const tableId = searchParams.get("tableId");
    const sessionId = searchParams.get("sessionId");
    const branchId = searchParams.get("branchId");
    if (!tableId && !sessionId && !branchId) {
      return badRequest("tableId, sessionId, or branchId is required");
    }

    // Optional explicit status filter (CSV), used alongside branchId.
    const statuses = searchParams
      .get("statuses")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) as OrderStatus[] | undefined;

    const orders = await listOrders({
      tableId,
      sessionId,
      branchId,
      active: searchParams.get("active") === "true",
      statuses,
    });
    return Response.json({ orders });
  } catch (err) {
    return handleError(err, "GET /api/orders");
  }
}

export async function POST(req: Request) {
  try {
    const { data, error } = await parseBody(req, orderCreateSchema);
    if (error) return error;

    const order = await placeOrder(data, {
      originSocketId: req.headers.get("x-rms-socket-id"),
    });
    return Response.json({ order }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/orders");
  }
}
