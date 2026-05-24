import type { ApiError } from "@/types";

export class ApiRequestError extends Error {
  code: string;
  details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

/** fetch wrapper that throws ApiRequestError on non-2xx and parses JSON. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = (json as ApiError).error;
    throw new ApiRequestError(
      err?.code ?? "ERROR",
      err?.message ?? res.statusText,
      err?.details,
    );
  }
  return json as T;
}
