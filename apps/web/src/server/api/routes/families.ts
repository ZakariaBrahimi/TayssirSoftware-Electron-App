import { Hono } from "hono";
import { familyInput, idParam } from "@/lib/validators";
import { db } from "../../db";
import * as families from "../../services/families";
import { type AppEnv, requireAdmin, requireEntitlement, validate } from "../context";

/** Products sold in several versions (sizes, colours...). */
export const familiesRoutes = new Hono<AppEnv>()
  .use(requireEntitlement)
  .get("/:id", validate("param", idParam), async (c) =>
    c.json(await families.getFamily(db, c.get("ctx"), c.req.valid("param").id)),
  )
  .post("/", requireAdmin, validate("json", familyInput), async (c) =>
    c.json(await families.createFamily(db, c.get("ctx"), c.req.valid("json")), 201),
  )
  .put("/:id", requireAdmin, validate("param", idParam), validate("json", familyInput), async (c) =>
    c.json(
      await families.updateFamily(db, c.get("ctx"), c.req.valid("param").id, c.req.valid("json")),
    ),
  )
  .delete("/:id", requireAdmin, validate("param", idParam), async (c) =>
    c.json(await families.deleteFamily(db, c.get("ctx"), c.req.valid("param").id)),
  );
