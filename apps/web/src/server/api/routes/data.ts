import { Hono } from "hono";
import { z } from "zod";
import { db } from "../../db";
import { AppError } from "../../errors";
import {
  exportCustomers,
  exportProducts,
  exportSales,
  importProducts,
} from "../../services/data-io";
import { getStore } from "../../services/stores";
import {
  type AppEnv,
  requireAdmin,
  requireEntitlement,
  requireFeature,
  validate,
} from "../context";

const csv = (body: string, name: string) =>
  new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
    },
  });

const today = () => new Date().toISOString().slice(0, 10);

export const dataRoutes = new Hono<AppEnv>()
  .use(requireAdmin)
  .get("/export/products", async (c) => {
    const store = await getStore(db, c.get("ctx").storeId);
    return csv(await exportProducts(db, c.get("ctx"), store.currency), `products-${today()}.csv`);
  })
  .get("/export/customers", async (c) => {
    const store = await getStore(db, c.get("ctx").storeId);
    return csv(await exportCustomers(db, c.get("ctx"), store.currency), `customers-${today()}.csv`);
  })
  .get(
    "/export/sales",
    validate(
      "query",
      z.object({
        from: z.iso.datetime({ offset: true }).optional(),
        to: z.iso.datetime({ offset: true }).optional(),
      }),
    ),
    async (c) => {
      const store = await getStore(db, c.get("ctx").storeId);
      const { from, to } = c.req.valid("query");
      const range = { from: from ?? new Date(Date.now() - 365 * 86_400_000).toISOString(), to };
      return csv(
        await exportSales(db, c.get("ctx"), store.currency, range),
        `sales-${today()}.csv`,
      );
    },
  )
  .post(
    "/import/products",
    requireEntitlement,
    requireFeature("import"),
    validate("query", z.object({ dryRun: z.enum(["true", "false"]).default("true") })),
    async (c) => {
      const text = await c.req.text();
      if (!text || text.length > 20_000_000) throw new AppError("VALIDATION_ERROR", "Invalid file");
      const store = await getStore(db, c.get("ctx").storeId);
      return c.json(
        await importProducts(db, c.get("ctx"), store.currency, text, {
          dryRun: c.req.valid("query").dryRun === "true",
        }),
      );
    },
  );
