import { Hono } from "hono";
import { z } from "zod";
import {
  customerInput,
  idParam,
  partyListQuery,
  paymentInput,
  supplierInput,
} from "@/lib/validators";
import { db } from "../../db";
import * as customers from "../../services/customers";
import { supplierStatement } from "../../services/purchases";
import * as suppliers from "../../services/suppliers";
import {
  type AppEnv,
  requireAdmin,
  requireEntitlement,
  validate,
  requireFeature,
} from "../context";

export const customersRoutes = new Hono<AppEnv>()
  .use(requireEntitlement)
  .get("/", validate("query", partyListQuery), async (c) =>
    c.json(await customers.listCustomers(db, c.get("ctx"), c.req.valid("query"))),
  )
  .get(
    "/options",
    validate("query", z.object({ q: z.string().max(120).optional() })),
    async (c) => {
      const rows = await customers.listCustomerOptions(db, c.get("ctx"), c.req.valid("query").q);
      return c.json(rows.map((r) => ({ ...r, balance: Number(r.balance) })));
    },
  )
  .get("/:id", validate("param", idParam), async (c) =>
    c.json(await customers.getCustomer(db, c.get("ctx"), c.req.valid("param").id)),
  )
  .get("/:id/statement", validate("param", idParam), async (c) =>
    c.json(await customers.customerStatement(db, c.get("ctx"), c.req.valid("param").id)),
  )
  // Cashiers can register customers at the till and take their payments.
  .post("/", validate("json", customerInput), async (c) =>
    c.json(await customers.createCustomer(db, c.get("ctx"), c.req.valid("json")), 201),
  )
  .patch(
    "/:id",
    requireAdmin,
    validate("param", idParam),
    validate("json", customerInput),
    async (c) =>
      c.json(
        await customers.updateCustomer(
          db,
          c.get("ctx"),
          c.req.valid("param").id,
          c.req.valid("json"),
        ),
      ),
  )
  .delete("/:id", requireAdmin, validate("param", idParam), async (c) =>
    c.json(await customers.deleteCustomer(db, c.get("ctx"), c.req.valid("param").id)),
  )
  .post("/:id/payments", validate("param", idParam), validate("json", paymentInput), async (c) =>
    c.json(
      await customers.recordCustomerPayment(
        db,
        c.get("ctx"),
        c.req.valid("param").id,
        c.req.valid("json"),
      ),
      201,
    ),
  );

export const suppliersRoutes = new Hono<AppEnv>()
  .use(requireAdmin, requireEntitlement, requireFeature("suppliers"))
  .get("/", validate("query", partyListQuery), async (c) =>
    c.json(await suppliers.listSuppliers(db, c.get("ctx"), c.req.valid("query"))),
  )
  .get("/:id", validate("param", idParam), async (c) =>
    c.json(await suppliers.getSupplier(db, c.get("ctx"), c.req.valid("param").id)),
  )
  .get("/:id/statement", validate("param", idParam), async (c) =>
    c.json(await supplierStatement(db, c.get("ctx"), c.req.valid("param").id)),
  )
  .post("/", validate("json", supplierInput), async (c) =>
    c.json(await suppliers.createSupplier(db, c.get("ctx"), c.req.valid("json")), 201),
  )
  .patch("/:id", validate("param", idParam), validate("json", supplierInput), async (c) =>
    c.json(
      await suppliers.updateSupplier(
        db,
        c.get("ctx"),
        c.req.valid("param").id,
        c.req.valid("json"),
      ),
    ),
  )
  .delete("/:id", validate("param", idParam), async (c) =>
    c.json(await suppliers.deleteSupplier(db, c.get("ctx"), c.req.valid("param").id)),
  )
  .post("/:id/payments", validate("param", idParam), validate("json", paymentInput), async (c) =>
    c.json(
      await suppliers.recordSupplierPayment(
        db,
        c.get("ctx"),
        c.req.valid("param").id,
        c.req.valid("json"),
      ),
      201,
    ),
  );
