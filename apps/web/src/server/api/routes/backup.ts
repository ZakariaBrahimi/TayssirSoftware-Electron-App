import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { db } from "../../db";
import { AppError } from "../../errors";
import * as backup from "../../services/backup";
import { type AppEnv, onlyMode, requireAdmin } from "../context";

/** Restart code understood by the desktop app (and Docker restart policies). */
export const RESTART_EXIT_CODE = 75;

export const backupRoutes = new Hono<AppEnv>()
  .use(onlyMode("local"), requireAdmin)
  .get("/", async (c) =>
    c.json({
      available: backup.backupsAvailable(),
      backups: backup.backupsAvailable() ? backup.listBackups() : [],
    }),
  )
  .post("/", async (c) => c.json(await backup.createBackup(db, "manual"), 201))
  .get("/:name", async (c) => {
    const file = backup.backupFilePath(c.req.param("name"));
    return new Response(new Uint8Array(await readFile(file)), {
      headers: {
        "content-type": "application/vnd.sqlite3",
        "content-disposition": `attachment; filename="${c.req.param("name")}"`,
      },
    });
  })
  /** Restores an uploaded backup (or a listed one) and restarts the server. */
  .post("/restore", async (c) => {
    const type = c.req.header("content-type") ?? "";
    if (type.includes("multipart/form-data")) {
      const form = await c.req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new AppError("RESTORE_INVALID");
      if (file.size > 2_000_000_000) throw new AppError("RESTORE_INVALID");
      await backup.stageRestore(new Uint8Array(await file.arrayBuffer()));
    } else {
      const { name } = (await c.req.json().catch(() => ({}))) as { name?: string };
      if (!name) throw new AppError("RESTORE_INVALID");
      await backup.stageRestore(backup.backupFilePath(name));
    }
    // Restart after the response is sent; the restore happens at boot.
    setTimeout(() => process.exit(RESTART_EXIT_CODE), 500).unref?.();
    return c.json({ restarting: true });
  });
