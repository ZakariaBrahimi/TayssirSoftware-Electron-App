import { Hono } from "hono";
import { z } from "zod";
import { licenseActivateInput } from "@/lib/validators";
import { db } from "../../db";
import { AppError } from "../../errors";
import { getDeviceId, getEntitlement } from "../../licensing/entitlements";
import { licenseServerUrl } from "../../licensing/client";
import { activateLicense, refreshLicense } from "../../licensing/server";
import { appVersion, cleanVersion, VERSION_HEADER } from "../../version";
import { setMeta } from "../../services/meta";
import { type AppEnv, onlyMode, rateLimit, requireAdmin, validate } from "../context";

/** Local mode: license status and activation of this install. */
export const licenseRoutes = new Hono<AppEnv>()
  .use(onlyMode("local"))
  .get("/", async (c) => c.json(await getEntitlement(db, c.get("ctx").storeId)))
  .post("/activate", requireAdmin, validate("json", licenseActivateInput), async (c) => {
    const server = licenseServerUrl();
    if (!server) throw new AppError("NOT_AVAILABLE", "No license server configured");
    let res: Response;
    try {
      res = await fetch(`${server}/api/licenses/activate`, {
        method: "POST",
        headers: { "content-type": "application/json", [VERSION_HEADER]: appVersion() },
        body: JSON.stringify({
          key: c.req.valid("json").key,
          deviceId: await getDeviceId(db),
          deviceName: process.env.TAYSSIR_DEVICE_NAME ?? "Desktop",
        }),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new AppError("SYNC_FAILED", "Cannot reach the license server");
    }
    const body = (await res.json().catch(() => null)) as {
      token?: string;
      error?: { code?: string };
    } | null;
    if (!res.ok || !body?.token) {
      const code = body?.error?.code;
      throw new AppError(
        code === "LICENSE_EXPIRED" || code === "ACTIVATION_LIMIT" || code === "RATE_LIMITED"
          ? code
          : "LICENSE_INVALID",
      );
    }
    await setMeta(db, "licenseToken", body.token);
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
