import { Hono } from "hono";
import { z } from "zod";
import {
  barcodeSchema,
  idParam,
  productCreateInput,
  productListQuery,
  productUpdateInput,
  stockAdjustmentInput,
} from "@/lib/validators";
import { db } from "../../db";
import * as products from "../../services/products";
import { type AppEnv, requireAdmin, validate } from "../context";

export const productsRoutes = new Hono<AppEnv>()
  .get("/", validate("query", productListQuery), async (c) =>
    c.json(await products.listProducts(db, c.req.valid("query"))),
  )
  .get("/by-barcode/:barcode", validate("param", z.object({ barcode: barcodeSchema })), async (c) =>
    c.json(await products.findByBarcode(db, c.req.valid("param").barcode)),
  )
  .get(
    "/barcode-available",
    validate(
      "query",
      z.object({
        barcode: barcodeSchema,
        exceptId: z.coerce.number().int().positive().optional(),
      }),
    ),
    async (c) => {
      const { barcode, exceptId } = c.req.valid("query");
      const taken = await products.isBarcodeTaken(db, barcode, exceptId);
      return c.json({ available: !taken });
    },
  )
  .post("/generate-barcode", requireAdmin, async (c) =>
    c.json({ barcode: await products.generateUniqueBarcode(db) }),
  )
  .get("/:id", validate("param", idParam), async (c) =>
    c.json(await products.getProduct(db, c.req.valid("param").id)),
  )
  .post("/", requireAdmin, validate("json", productCreateInput), async (c) =>
    c.json(await products.createProduct(db, c.req.valid("json"), c.get("user").id), 201),
  )
  .patch(
    "/:id",
    requireAdmin,
    validate("param", idParam),
    validate("json", productUpdateInput),
    async (c) =>
      c.json(await products.updateProduct(db, c.req.valid("param").id, c.req.valid("json"))),
  )
  .delete("/:id", requireAdmin, validate("param", idParam), async (c) =>
    c.json(await products.deleteProduct(db, c.req.valid("param").id)),
  )
  .post(
    "/:id/stock",
    requireAdmin,
    validate("param", idParam),
    validate("json", stockAdjustmentInput),
    async (c) =>
      c.json(
        await products.adjustStock(
          db,
          c.req.valid("param").id,
          c.req.valid("json"),
          c.get("user").id,
        ),
      ),
  )
  .get("/:id/movements", requireAdmin, validate("param", idParam), async (c) =>
    c.json(await products.listStockMovements(db, c.req.valid("param").id)),
  );
