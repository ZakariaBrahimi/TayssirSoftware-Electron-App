import { Hono } from "hono";
import { reportQuery } from "@/lib/validators";
import { db } from "../../db";
import { inventoryOverview, salesReport } from "../../services/reports";
import { type AppEnv, requireAdmin, validate } from "../context";

export const reportsRoutes = new Hono<AppEnv>()
  .use(requireAdmin)
  .get("/sales", validate("query", reportQuery), async (c) =>
    c.json(await salesReport(db, c.get("ctx"), c.req.valid("query"))),
  )
  .get("/inventory", async (c) => c.json(await inventoryOverview(db, c.get("ctx"))));
