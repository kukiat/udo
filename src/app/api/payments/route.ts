import { handleError, parseBody } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { paymentSchema } from "@/lib/validation";
import { paymentService } from "@/services/payments";

// Take payment for a table session: recompute the bill, record the payment,
// mark the bill paid, close the session, and free the table.
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const { data, error } = await parseBody(req, paymentSchema);
    if (error) return error;

    const { payment, bill, receipt } = await paymentService.settle(data, { user });
    return Response.json({ payment, bill, receipt }, { status: 201 });
  } catch (err) {
    return handleError(err, "POST /api/payments");
  }
}
