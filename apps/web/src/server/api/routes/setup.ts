import { Hono } from "hono";
import { setupInput } from "@/lib/validators";
import { auth } from "../../auth";
import { db } from "../../db";
import { AppError } from "../../errors";
import { needsSetup, updateSettings } from "../../services/settings";
import { validate } from "../context";

/** First-run wizard: creates the store and the first administrator. */
export const setupRoutes = new Hono()
  .get("/", async (c) => c.json({ needsSetup: await needsSetup(db) }))
  .post("/", validate("json", setupInput), async (c) => {
    if (!(await needsSetup(db))) throw new AppError("SETUP_ALREADY_DONE");
    const input = c.req.valid("json");
    const username = input.username.toLowerCase();

    await auth.api.createUser({
      body: {
        name: input.name,
        // Better Auth requires an email; staff log in with their username.
        email: `${username}@tayssir.local`,
        password: input.password,
        role: "admin",
        data: { username, displayUsername: input.username },
      },
    });
    await updateSettings(db, {
      storeName: input.storeName,
      currency: input.currency,
    });
    return c.json({ ok: true }, 201);
  });
