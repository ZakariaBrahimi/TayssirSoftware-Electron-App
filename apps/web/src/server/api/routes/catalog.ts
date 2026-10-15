import { Hono } from "hono";
import { idParam, namedEntityInput } from "@/lib/validators";
import { db } from "../../db";
import { brandService, categoryService } from "../../services/catalog";
import { type AppEnv, requireAdmin, requireEntitlement, validate } from "../context";

function namedEntityRoutes(service: typeof categoryService) {
  return new Hono<AppEnv>()
    .use(requireEntitlement)
    .get("/", async (c) => c.json(await service.list(db, c.get("ctx"))))
    .post("/", requireAdmin, validate("json", namedEntityInput), async (c) =>
      c.json(await service.create(db, c.get("ctx"), c.req.valid("json").name), 201),
    )
    .patch(
      "/:id",
      requireAdmin,
      validate("param", idParam),
      validate("json", namedEntityInput),
      async (c) =>
        c.json(
          await service.update(db, c.get("ctx"), c.req.valid("param").id, c.req.valid("json").name),
        ),
    )
    .delete("/:id", requireAdmin, validate("param", idParam), async (c) =>
      c.json(await service.remove(db, c.get("ctx"), c.req.valid("param").id)),
    );
}

export const categoriesRoutes = namedEntityRoutes(categoryService);
export const brandsRoutes = namedEntityRoutes(brandService);
