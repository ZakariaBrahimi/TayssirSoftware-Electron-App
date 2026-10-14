import { Hono } from "hono";
import { settingsInput } from "@/lib/validators";
import { db } from "../../db";
import { getSettings, updateSettings } from "../../services/settings";
import { type AppEnv, requireAdmin, validate } from "../context";

export const settingsRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(await getSettings(db)))
  .put("/", requireAdmin, validate("json", settingsInput), async (c) =>
    c.json(await updateSettings(db, c.req.valid("json"))),
  );
