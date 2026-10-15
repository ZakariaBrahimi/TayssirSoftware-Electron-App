import { Hono } from "hono";
import { z } from "zod";
import { licenseActivateInput } from "@/lib/validators";
import { db } from "../../db";
import { AppError } from "../../errors";
import { activateWithKey } from "../../licensing/client";
import { getEntitlement } from "../../licensing/entitlements";
import { activateLicense, refreshLicense } from "../../licensing/server";
import { cleanVersion, VERSION_HEADER } from "../../version";
import { setMeta } from "../../services/meta";
import { type AppEnv, onlyMode, rateLimit, requireAdmin, validate } from "../context";

/** Local mode: license status and activation of this install. */
export const licenseRoutes = new Hono<AppEnv>()
  .use(onlyMode("local"))
  .get("/", async (c) => c.json(await getEntitlement(db, c.get("ctx").storeId)))
  .post("/activate", requireAdmin, validate("json", licenseActivateInput), async (c) => {
    await activateWithKey(db, c.req.valid("json").key);
    const ent = await getEntitlement(db, c.get("ctx").storeId);
    if (ent.source !== "license") throw new AppError("LICENSE_INVALID"); // wrong signing key
    return c.json(ent);
  })
  .delete("/", requireAdmin, async (c) => {
    await setMeta(db, "licenseToken", null);
    return c.json(await getEntitlement(db, c.get("ctx").storeId));
  });

/** Cloud mode: the vendor's license server used by desktop installs. */
export const licenseServerRoutes = new Hono()
  .use(onlyMode("cloud"))
  .post(
    "/activate",
    rateLimit("license-activate", 20, 60 * 60_000),
    validate(
      "json",
      z.object({
        key: licenseActivateInput.shape.key,
        deviceId: z.string().min(8).max(128),
        deviceName: z.string().max(60).optional(),
      }),
    ),
    async (c) =>
      c.json(
        await activateLicense(db, {
          ...c.req.valid("json"),
          appVersion: cleanVersion(c.req.header(VERSION_HEADER)),
        }),
      ),
  )
  .post(
    "/refresh",
    rateLimit("license-refresh", 60, 60 * 60_000),
    validate("json", z.object({ token: z.string().min(10).max(4096) })),
    async (c) =>
      c.json(
        await refreshLicense(db, {
          token: c.req.valid("json").token,
          appVersion: cleanVersion(c.req.header(VERSION_HEADER)),
        }),
      ),
  );
