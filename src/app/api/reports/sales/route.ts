import { badRequest, handleError } from "@/lib/api";
import { computeSalesReport, resolveReportRange } from "@/lib/reports";

// Sales analytics for a branch over a date range, derived from recorded
// payments (actual revenue) and the order items behind each paid bill.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    if (!branchId) return badRequest("branchId is required");

    const tzMin = parseInt(searchParams.get("tz") ?? "0", 10) || 0;
    const range = resolveReportRange({
      fromParam: searchParams.get("from"),
      toParam: searchParams.get("to"),
      tzMin,
      defaultDaysBack: 29,
    });
    if (!range) return badRequest("from/to must be YYYY-MM-DD dates");

    const report = await computeSalesReport(branchId, range, tzMin);
    return Response.json(report);
  } catch (err) {
    return handleError(err, "GET /api/reports/sales");
  }
}
