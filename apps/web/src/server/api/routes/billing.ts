import { Hono } from "hono";
import { z } from "zod";
import { paymentRequestInput } from "@/lib/validators/platform";
import { auth } from "../../auth";
import { db } from "../../db";
import { AppError } from "../../errors";
import { verifyEntitlement } from "../../licensing/token";
import {
  cancelOwnRequest,
  createRequest,
  listOwnRequests,
  publicCatalog,
  type Requester,
} from "../../platform/billing";
import { authenticateDevice } from "../../sync/cloud";
import { cancelRequest, getSubscription, sendRequest } from "../../subscription/service";
import { cleanVersion, VERSION_HEADER } from "../../version";
import { type AppEnv, onlyMode, rateLimit, requireAdmin, validate } from "../context";

type HeaderReader = { req: { header(name: string): string | undefined; raw: Request } };

/**
 * Who is asking, in this order: a signed-in store administrator, a linked
 * desktop (device token), a licensed PC (its signed license token), or an
 * unlicensed PC (its id; approval then creates a license for it).
 */
async function resolveRequester(c: HeaderReader): Promise<Requester> {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
    query: { disableCookieCache: true },
  });
  const u = session?.user as { role?: string; storeId?: string | null } | undefined;
  if (u?.storeId) {
    if (u.role !== "admin") throw new AppError("FORBIDDEN");
    return { type: "store", storeId: u.storeId };
  }
  const bearer = c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (bearer) {
    const device = await authenticateDevice(db, bearer, cleanVersion(c.req.header(VERSION_HEADER)));
    return { type: "store", storeId: device.storeId };
  }
  const licenseToken = c.req.header("x-license-token");
  if (licenseToken) {
    const key = process.env.LICENSE_PRIVATE_KEY;
    const payload = key ? verifyEntitlement(licenseToken, key) : null;
    if (!payload || payload.kind !== "license") throw new AppError("UNAUTHORIZED");
    return { type: "license", licenseId: payload.ref, deviceId: payload.dev };
  }
  const deviceId = c.req.header("x-device-id");
  if (deviceId && /^[\w-]{8,128}$/.test(deviceId)) return { type: "device", deviceId };
  throw new AppError("UNAUTHORIZED");
}

/** Cloud mode: plans and payment requests for shops and desktops. */
export const billingRoutes = new Hono()
  .use(onlyMode("cloud"))
  .get("/catalog", async (c) => c.json(await publicCatalog(db)))
  .get("/requests", async (c) => c.json(await listOwnRequests(db, await resolveRequester(c))))
  .post(
    "/requests",
    rateLimit("billing-request", 10, 60 * 60_000),
    validate("json", paymentRequestInput),
    async (c) =>
      c.json(await createRequest(db, await resolveRequester(c), c.req.valid("json")), 201),
  )
  .post("/requests/:id/cancel", async (c) =>
    c.json(await cancelOwnRequest(db, await resolveRequester(c), c.req.param("id"))),
  );

/** Both modes: the store administrator's subscription page. */
export const subscriptionRoutes = new Hono<AppEnv>()
  .use(requireAdmin)
  .get("/", async (c) => c.json(await getSubscription(db, c.get("ctx").storeId)))
  .post(
    "/requests",
    rateLimit("subscription-request", 10, 60 * 60_000),
    validate("json", paymentRequestInput),
    async (c) => c.json(await sendRequest(db, c.get("ctx").storeId, c.req.valid("json")), 201),
  )
  .post(
    "/requests/:id/cancel",
    validate("param", z.object({ id: z.string().min(1).max(64) })),
    async (c) => c.json(await cancelRequest(db, c.get("ctx").storeId, c.req.valid("param").id)),
  );
