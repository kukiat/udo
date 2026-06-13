import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

import { ServiceError } from "@/services/errors";
import type { ApiError } from "@/types";

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse<ApiError> {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export function validationError(err: ZodError): NextResponse<ApiError> {
  return errorResponse(
    "VALIDATION_ERROR",
    "Request validation failed",
    400,
    err.issues,
  );
}

export function notFound(message = "Resource not found") {
  return errorResponse("NOT_FOUND", message, 404);
}

export function badRequest(message: string, details?: unknown) {
  return errorResponse("BAD_REQUEST", message, 400, details);
}

export function serverError(message = "Internal server error") {
  return errorResponse("INTERNAL_ERROR", message, 500);
}

/**
 * Map a thrown error to a response. A `ServiceError` carries its own
 * code/status/details (the route's expected failure modes); anything else is
 * logged under `scope` and returned as a 500. Lets route handlers reduce their
 * catch block to `return handleError(err, "POST /api/...")`.
 */
export function handleError(err: unknown, scope: string): NextResponse<ApiError> {
  if (err instanceof ServiceError) {
    return errorResponse(err.code, err.message, err.status, err.details);
  }
  console.error(scope, err);
  return serverError();
}

/** Parse and validate a JSON request body, returning either data or a response. */
export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse<ApiError> }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: badRequest("Invalid JSON body") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) return { error: validationError(result.error) };
  return { data: result.data };
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const rawLimit = Number(searchParams.get("limit")) || DEFAULT_LIMIT;
  const limit = Math.min(MAX_LIMIT, Math.max(1, rawLimit));
  return { page, limit, offset: (page - 1) * limit };
}
