import { handleError } from "@/lib/api";
import { bootstrapService } from "@/services/bootstrap";

// Phase 1 has no auth: resolve the current restaurant/branch as the first
// seeded ones so the dashboard and KDS have a context to operate in.
export async function GET() {
  try {
    const result = await bootstrapService.get();
    return Response.json(result);
  } catch (err) {
    return handleError(err, "GET /api/bootstrap");
  }
}
