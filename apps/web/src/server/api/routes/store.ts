import { Hono } from "hono";
import { storeSettingsInput, userCreateInput, userUpdateInput } from "@/lib/validators";
import { getMode } from "../../context";
import { db } from "../../db";
import { getEntitlement } from "../../licensing/entitlements";
import { getStore, publicStore, updateStore } from "../../services/stores";
import * as users from "../../services/users";
import { type AppEnv, requireAdmin, validate } from "../context";

/** Everything the app shell needs about the signed-in user, in one call. */
export const meRoutes = new Hono<AppEnv>().get("/", async (c) => {
  const user = c.get("user");
  const ctx = c.get("ctx");
  const store = await getStore(db, ctx.storeId);
  return c.json({
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      username: (user as { displayUsername?: string }).displayUsername ?? null,
    },
    store: publicStore(store),
    mode: getMode(),
    entitlement: await getEntitlement(db, ctx.storeId),
  });
});

export const settingsRoutes = new Hono<AppEnv>()
  .get("/", async (c) => c.json(publicStore(await getStore(db, c.get("ctx").storeId))))
  .put("/", requireAdmin, validate("json", storeSettingsInput), async (c) =>
    c.json(publicStore(await updateStore(db, c.get("ctx").storeId, c.req.valid("json")))),
  );

export const usersRoutes = new Hono<AppEnv>()
  .use(requireAdmin)
  .get("/", async (c) => c.json(await users.listUsers(db, c.get("ctx"))))
  .post("/", validate("json", userCreateInput), async (c) =>
    c.json(await users.createUser(db, c.get("ctx"), c.req.valid("json")), 201),
  )
  .patch("/:id", validate("json", userUpdateInput), async (c) =>
    c.json(await users.updateUser(db, c.get("ctx"), c.req.param("id"), c.req.valid("json"))),
  )
  .delete("/:id", async (c) => c.json(await users.deleteUser(db, c.get("ctx"), c.req.param("id"))));
