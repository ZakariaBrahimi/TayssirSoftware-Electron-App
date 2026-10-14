const STATUS = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  TWO_FACTOR_REQUIRED: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  BARCODE_TAKEN: 409,
  NAME_TAKEN: 409,
  USERNAME_TAKEN: 409,
  INSUFFICIENT_STOCK: 409,
  /** A product sold by the piece got a fractional quantity. */
  QUANTITY_WHOLE: 422,
  PRODUCT_INACTIVE: 409,
  INVALID_DISCOUNT: 400,
  INSUFFICIENT_PAYMENT: 400,
  CUSTOMER_REQUIRED: 400,
  CREDIT_LIMIT_EXCEEDED: 409,
  SALE_ALREADY_VOIDED: 409,
  SALE_HAS_RETURNS: 409,
  RETURN_EXCEEDS_SALE: 409,
  SHIFT_REQUIRED: 409,
  SHIFT_ALREADY_OPEN: 409,
  NO_OPEN_SHIFT: 409,
  SETUP_ALREADY_DONE: 409,
  LICENSE_REQUIRED: 402,
  PLAN_REQUIRED: 402,
  PLAN_LIMIT: 402,
  PRICE_NOT_SET: 409,
  REQUEST_PENDING: 409,
  LICENSE_INVALID: 400,
  LICENSE_EXPIRED: 402,
  ACTIVATION_LIMIT: 409,
  NOT_AVAILABLE: 404,
  SYNC_NOT_LINKED: 409,
  SYNC_FAILED: 502,
  RESTORE_INVALID: 400,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof STATUS;

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
