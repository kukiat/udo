// Typed failure raised by use-case functions in src/services/*. Services never
// build HTTP responses; routes map this to the standard error envelope via
// serviceErrorResponse() in src/lib/api.ts.
export class ServiceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
