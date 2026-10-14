import { Hono } from "hono";
import { idParam, returnCreateInput, saleCreateInput, saleListQuery } from "@/lib/validators";
import { getMode } from "../../context";
import { db } from "../../db";
import { AppError } from "../../errors";
import { getDeviceCode } from "../../services/meta";
import { createReturn } from "../../services/returns";
import * as sales from "../../services/sales";
import { type AppEnv, isAdmin, requireAdmin, requireEntitlement, validate } from "../context";

/** Receipt prefix: per install locally, "W" for sales made on the web. */
const deviceCode = async () => (getMode() === "cloud" ? "W" : getDeviceCode(db));

export const salesRoutes = new Hono<AppEnv>()
  .use(requireEntitlement)
  .get("/", validate("query", saleListQuery), async (c) => {
    const user = c.get("user");
    // Cashiers only see their own sales.
    const cashierId = isAdmin(user) ? undefined : user.id;
    return c.json(await sales.listSales(db, c.get("ctx"), c.req.valid("query"), { cashierId }));
  })
  .get("/:id", validate("param", idParam), async (c) => {
    const user = c.get("user");
    const sale = await sales.getSale(db, c.get("ctx"), c.req.valid("param").id);
    if (!isAdmin(user) && sale.cashierId !== user.id) throw new AppError("NOT_FOUND");
    return c.json(sale);
  })
  .post("/", validate("json", saleCreateInput), async (c) =>
    c.json(
      await sales.createSale(db, c.get("ctx"), c.req.valid("json"), { deviceCode: await deviceCode() }),
      201,
    ),
  )
  .post("/:id/void", requireAdmin, validate("param", idParam), async (c) =>
    c.json(await sales.voidSale(db, c.get("ctx"), c.req.valid("param").id)),
  )
  .post(
    "/:id/returns",
    requireAdmin,
    validate("param", idParam),
    validate("json", returnCreateInput),
    async (c) =>
      c.json(await createReturn(db, c.get("ctx"), c.req.valid("param").id, c.req.valid("json")), 201),
  );
