import { Hono } from "hono";
import { stockCountInput, thresholdsInput } from "@/lib/validators";
import { db } from "../../db";
import { setThresholds, stockAlerts } from "../../services/forecast";
import { applyStockCount } from "../../services/stock-count";
import { type AppEnv, requireAdmin, requireEntitlement, validate } from "../context";

/** Stock alerts and reorder suggestions. */
export const stockRoutes = new Hono<AppEnv>()
  .get("/alerts", async (c) => c.json(await stockAlerts(db, c.get("ctx"))))
  .post(
    "/thresholds",
    requireAdmin,
    requireEntitlement,
    validate("json", thresholdsInput),
    async (c) => c.json(await setThresholds(db, c.get("ctx"), c.req.valid("json").items)),
  )
  .post("/count", requireAdmin, requireEntitlement, validate("json", stockCountInput), async (c) =>
    c.json(await applyStockCount(db, c.get("ctx"), c.req.valid("json"))),
  );
