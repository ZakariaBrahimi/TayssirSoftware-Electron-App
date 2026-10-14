import { Hono } from "hono";
import { z } from "zod";
import { syncLinkInput } from "@/lib/validators";
import { db } from "../../db";
import {
  authenticateDevice,
  linkDevice,
  listDevices,
  receivePush,
  revokeDevice,
  servePull,
} from "../../sync/cloud";
import { getSyncStatus, link, syncNow, unlink } from "../../sync/client";
import { cleanVersion, VERSION_HEADER } from "../../version";
import { type AppEnv, onlyMode, rateLimit, requireAdmin, validate } from "../context";

/** Local mode: this install's connection to a cloud store. */
export const syncClientRoutes = new Hono<AppEnv>()
  .use(onlyMode("local"), requireAdmin)
  .get("/", async (c) => c.json(await getSyncStatus(db)))
  .post("/link", validate("json", syncLinkInput), async (c) =>
    c.json(await link(db, c.req.valid("json"))),
  )
  .post("/now", async (c) => c.json(await syncNow(db)))
  .post("/unlink", async (c) => c.json(await unlink(db)));

/** Cloud mode: devices linked to the signed-in admin's store. */
export const syncDevicesRoutes = new Hono<AppEnv>()
  .use(onlyMode("cloud"), requireAdmin)
  .get("/", async (c) => c.json(await listDevices(db, c.get("ctx").storeId)))
  .delete("/:id", async (c) =>
    c.json(await revokeDevice(db, c.get("ctx").storeId, c.req.param("id"))),
  );

const bearer = (header: string | undefined) => header?.replace(/^Bearer\s+/i, "");

type HeaderReader = { req: { header(name: string): string | undefined } };
const deviceAuth = (c: HeaderReader) =>
  authenticateDevice(
    db,
    bearer(c.req.header("authorization")),
    cleanVersion(c.req.header(VERSION_HEADER)),
  );

/** Cloud mode: endpoints called by desktop installs (device token auth). */
export const syncServerRoutes = new Hono()
  .use(onlyMode("cloud"))
  .post(
    "/link",
    rateLimit("sync-link", 10, 15 * 60_000),
    validate(
      "json",
      z.object({
        username: z.string().min(1),
        password: z.string().min(1),
        deviceName: z.string().trim().min(1).max(60),
        deviceId: z.string().max(128).default(""),
      }),
    ),
    async (c) =>
      c.json(
        await linkDevice(db, c.req.valid("json"), cleanVersion(c.req.header(VERSION_HEADER))),
        201,
      ),
  )
  .post(
    "/push",
    validate(
      "json",
      z.object({ changes: z.array(z.object({ tbl: z.string(), row: z.unknown() })).max(1000) }),
    ),
    async (c) => {
      const device = await deviceAuth(c);
      return c.json(await receivePush(db, device.storeId, c.req.valid("json").changes));
    },
  )
  .get(
    "/pull",
    validate(
      "query",
      z.object({
        cursor: z.coerce.number().int().min(0).default(0),
        deviceId: z.string().max(128).default(""),
      }),
    ),
    async (c) => {
      const device = await deviceAuth(c);
      const { cursor, deviceId } = c.req.valid("query");
      return c.json(await servePull(db, device.storeId, cursor, deviceId));
    },
  );
