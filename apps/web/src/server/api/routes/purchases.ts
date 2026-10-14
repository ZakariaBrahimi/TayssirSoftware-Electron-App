import { Hono } from "hono";
import { idParam, purchaseCreateInput, purchaseListQuery } from "@/lib/validators";
import { db } from "../../db";
import * as purchases from "../../services/purchases";
import {
  type AppEnv,
  requireAdmin,
  requireEntitlement,
  validate,
  requireFeature,
} from "../context";

export const purchasesRoutes = new Hono<AppEnv>()
  .use(requireAdmin, requireEntitlement, requireFeature("suppliers"))
  .get("/", validate("query", purchaseListQuery), async (c) =>
    c.json(await purchases.listPurchases(db, c.get("ctx"), c.req.valid("query"))),
  )
  .get("/:id", validate("param", idParam), async (c) =>
    c.json(await purchases.getPurchase(db, c.get("ctx"), c.req.valid("param").id)),
  )
  .post("/", validate("json", purchaseCreateInput), async (c) =>
    c.json(await purchases.createPurchase(db, c.get("ctx"), c.req.valid("json")), 201),
  );
