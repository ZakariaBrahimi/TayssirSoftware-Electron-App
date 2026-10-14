export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "BARCODE_TAKEN"
  | "NAME_TAKEN"
  | "INSUFFICIENT_STOCK"
  | "PRODUCT_INACTIVE"
  | "INVALID_DISCOUNT"
  | "INSUFFICIENT_PAYMENT"
  | "SALE_ALREADY_VOIDED"
  | "SETUP_ALREADY_DONE"
  | "INTERNAL_ERROR";

const STATUS: Record<ErrorCode, 400 | 401 | 403 | 404 | 409 | 500> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  BARCODE_TAKEN: 409,
  NAME_TAKEN: 409,
  INSUFFICIENT_STOCK: 409,
  PRODUCT_INACTIVE: 409,
  INVALID_DISCOUNT: 400,
  INSUFFICIENT_PAYMENT: 400,
  SALE_ALREADY_VOIDED: 409,
  SETUP_ALREADY_DONE: 409,
  INTERNAL_ERROR: 500,
};

/** Domain error with a stable code the UI can translate. */
export class AppError extends Error {
  readonly status: (typeof STATUS)[ErrorCode];

  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}

/** True for SQLite UNIQUE constraint violations (possibly wrapped by drizzle). */
export function isUniqueViolation(err: unknown, column?: string): boolean {
  let e: unknown = err;
  for (let depth = 0; e && depth < 5; depth++) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE constraint failed")) {
      return column ? msg.includes(column) : true;
    }
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}
