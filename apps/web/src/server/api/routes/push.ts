import { Hono } from "hono";
import { z } from "zod";
import { registerDevice, unregisterDevice } from "../../alerts/service";
import { db } from "../../db";
import { AppError } from "../../errors";
import { type AppEnv, onlyMode, requireAdmin, validate } from "../context";

const deviceInput = z.object({
  token: z.string().trim().min(10).max(4096),
  platform: z.enum(["android", "ios"]).default("android"),
});

/** Phones of the shop's owners/admins that get push notifications (Android app). */
export const pushRoutes = new Hono<AppEnv>()
  .use(onlyMode("cloud"), requireAdmin)
  .post("/devices", validate("json", deviceInput), async (c) => {
    const ctx = c.get("ctx");
    if (!ctx.userId) throw new AppError("UNAUTHORIZED");
    const input = c.req.valid("json");
    return c.json(await registerDevice(db, { ...input, storeId: ctx.storeId, userId: ctx.userId }));
  })
  .delete("/devices", validate("json", deviceInput.pick({ token: true })), async (c) =>
    c.json(await unregisterDevice(db, c.req.valid("json").token)),
  );
