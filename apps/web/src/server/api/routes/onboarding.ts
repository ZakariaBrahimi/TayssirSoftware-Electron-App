import { Hono } from "hono";
import { setupInput } from "@/lib/validators";
import { getMode } from "../../context";
import { db } from "../../db";
import { AppError } from "../../errors";
import { createStore, needsSetup } from "../../services/stores";
import { createStoreUser } from "../../services/users";
import { onlyMode, rateLimit, validate } from "../context";

/** Public information the login/setup/sign-up pages need. */
export const appInfoRoutes = new Hono().get("/", async (c) => {
  const mode = getMode();
  return c.json({
    mode,
    needsSetup: mode === "local" ? await needsSetup(db) : false,
    signupEnabled: mode === "cloud",
  });
});

/** Local mode, first run: creates the store and its administrator. */
export const setupRoutes = new Hono()
  .use(onlyMode("local"))
  .get("/", async (c) => c.json({ needsSetup: await needsSetup(db) }))
  .post("/", validate("json", setupInput), async (c) => {
    if (!(await needsSetup(db))) throw new AppError("SETUP_ALREADY_DONE");
    const input = c.req.valid("json");
    const store = await createStore(db, { name: input.storeName, currency: input.currency });
    await createStoreUser(db, store.id, {
      name: input.name,
      username: input.username,
      password: input.password,
      role: "admin",
    });
    return c.json({ ok: true }, 201);
  });

/** Cloud mode: anyone can create a store (starts a free trial). */
export const signupRoutes = new Hono()
  .use(onlyMode("cloud"), rateLimit("signup", 5, 60 * 60_000))
  .post("/", validate("json", setupInput), async (c) => {
    const input = c.req.valid("json");
    const store = await createStore(db, { name: input.storeName, currency: input.currency });
    await createStoreUser(db, store.id, {
      name: input.name,
      username: input.username,
      password: input.password,
      role: "admin",
    });
    return c.json({ ok: true }, 201);
  });
