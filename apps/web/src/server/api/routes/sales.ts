import { Hono } from "hono";
import { idParam, saleCreateInput, saleListQuery } from "@/lib/validators";
import { db } from "../../db";
import { AppError } from "../../errors";
import * as sales from "../../services/sales";
import { type AppEnv, isAdmin, requireAdmin, validate } from "../context";

export const salesRoutes = new Hono<AppEnv>()
  .get("/", validate("query", saleListQuery), async (c) => {
    const user = c.get("user");
    // Cashiers only see their own sales.
    const cashierId = isAdmin(user) ? undefined : user.id;
    return c.json(await sales.listSales(db, c.req.valid("query"), { cashierId }));
  })
  .get("/:id", validate("param", idParam), async (c) => {
    const user = c.get("user");
    const sale = await sales.getSale(db, c.req.valid("param").id);
    if (!isAdmin(user) && sale.cashierId !== user.id) {
      throw new AppError("NOT_FOUND");
    }
    return c.json(sale);
  })
  .post("/", validate("json", saleCreateInput), async (c) =>
    c.json(await sales.createSale(db, c.req.valid("json"), c.get("user").id), 201),
  )
  .post("/:id/void", requireAdmin, validate("param", idParam), async (c) =>
    c.json(await sales.voidSale(db, c.req.valid("param").id, c.get("user").id)),
  );
