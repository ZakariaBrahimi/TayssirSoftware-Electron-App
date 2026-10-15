import { hc } from "hono/client";
import type { AppType } from "@/server/api";

/** Typed client for the REST API (`/api/*`). */
export const api = hc<AppType>("/").api;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type JsonOf<R> = R extends { json(): Promise<infer T> } ? T : never;
type Success<R> = Exclude<JsonOf<R>, { error: unknown }>;

/** Resolves a typed fetch response, throwing an ApiError for non-2xx. */
export async function unwrap<R extends { ok: boolean; status: number; json(): Promise<unknown> }>(
  promise: Promise<R>,
): Promise<Success<R>> {
  let res: R;
  try {
    res = await promise;
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Network error");
  }
  const body = (await res.json().catch(() => null)) as {
    error?: { code?: string; message?: string; details?: Record<string, unknown> };
  } | null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      body?.error?.code ?? "INTERNAL_ERROR",
      body?.error?.message ?? res.status.toString(),
      body?.error?.details,
    );
  }
  return body as Success<R>;
}
