import { Hono } from "hono";
import { z } from "zod";
import { idParam } from "@/lib/validators";
import { DIGEST_LOCALES } from "../../alerts/digest";
import {
  addEmailChannel,
  alertOverview,
  createTelegramLink,
  handleTelegramUpdate,
  removeChannel,
  sendDigest,
  updateAlertSettings,
} from "../../alerts/service";
import { webhookSecret } from "../../alerts/telegram";
import { db } from "../../db";
import { AppError } from "../../errors";
import { type AppEnv, onlyMode, rateLimit, requireAdmin, validate } from "../context";

const settingsInput = z.object({
  enabled: z.boolean(),
  digestHour: z.number().int().min(0).max(23),
  locale: z.enum(DIGEST_LOCALES),
});

/** Daily stock summaries: settings and channels (cloud stores). */
export const alertsRoutes = new Hono<AppEnv>()
  .use(onlyMode("cloud"), requireAdmin)
  .get("/", async (c) => c.json(await alertOverview(db, c.get("ctx").storeId)))
  .put("/settings", validate("json", settingsInput), async (c) =>
    c.json(await updateAlertSettings(db, c.get("ctx").storeId, c.req.valid("json"))),
  )
  .post("/telegram", rateLimit("alerts-telegram", 20, 60 * 60_000), async (c) =>
    c.json(await createTelegramLink(db, c.get("ctx").storeId)),
  )
  .post(
    "/email",
    rateLimit("alerts-email", 20, 60 * 60_000),
    validate("json", z.object({ address: z.string().trim().email().max(200) })),
    async (c) =>
      c.json(await addEmailChannel(db, c.get("ctx").storeId, c.req.valid("json").address), 201),
  )
  .delete("/channels/:id", validate("param", idParam), async (c) =>
    c.json(await removeChannel(db, c.get("ctx").storeId, c.req.valid("param").id)),
  )
  .post("/test", rateLimit("alerts-test", 10, 60 * 60_000), async (c) =>
    c.json(await sendDigest(db, c.get("ctx").storeId, { force: true })),
  );

/** Messages sent to the Telegram bot (public, authenticated by a secret). */
export const telegramWebhookRoutes = new Hono()
  .use(onlyMode("cloud"))
  .post("/webhook", async (c) => {
    if (c.req.header("x-telegram-bot-api-secret-token") !== webhookSecret()) {
      throw new AppError("FORBIDDEN");
    }
    const update = await c.req.json().catch(() => ({}));
    await handleTelegramUpdate(db, update);
    return c.json({ ok: true });
  });
