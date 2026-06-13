import { badRequest, handleError } from "@/lib/api";
import { computeBranchSalesReport, resolveReportRange } from "@/lib/reports";

// Per-branch sales comparison for a restaurant over a date range, derived
// from recorded payments (actual revenue).
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const restaurantId = searchParams.get("restaurantId");
    if (!restaurantId) return badRequest("restaurantId is required");

    const tzMin = parseInt(searchParams.get("tz") ?? "0", 10) || 0;
    const range = resolveReportRange({
      fromParam: searchParams.get("from"),
      toParam: searchParams.get("to"),
      tzMin,
      defaultDaysBack: 6,
    });
    if (!range) return badRequest("from/to must be YYYY-MM-DD dates");

    const report = await computeBranchSalesReport(restaurantId, range, tzMin);
    return Response.json(report);
  } catch (err) {
    return handleError(err, "GET /api/reports/branch-sales");
  }
}
