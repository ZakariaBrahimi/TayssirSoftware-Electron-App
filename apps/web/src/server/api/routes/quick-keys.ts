import { Hono } from "hono";
import { quickKeysInput } from "@/lib/quick-keys";
import { db } from "../../db";
import { getQuickKeys, saveQuickKeys } from "../../services/quick-keys";
import { type AppEnv, requireAdmin, requireEntitlement, validate } from "../context";

/** Quick buttons of the till. */
export const quickKeysRoutes = new Hono<AppEnv>()
  .use(requireEntitlement)
  .get("/", async (c) => c.json(await getQuickKeys(db, c.get("ctx"))))
  .put("/", requireAdmin, validate("json", quickKeysInput), async (c) =>
    c.json(await saveQuickKeys(db, c.get("ctx"), c.req.valid("json").pages)),
  );
