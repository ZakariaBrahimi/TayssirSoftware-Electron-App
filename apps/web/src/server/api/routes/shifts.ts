import { Hono } from "hono";
import {
  cashMovementInput,
  idParam,
  shiftCloseInput,
  shiftListQuery,
  shiftOpenInput,
} from "@/lib/validators";
import { db } from "../../db";
import { AppError } from "../../errors";
import * as shifts from "../../services/shifts";
import { type AppEnv, isAdmin, requireEntitlement, validate } from "../context";

export const shiftsRoutes = new Hono<AppEnv>()
  .use(requireEntitlement)
  .get("/current", async (c) => c.json({ summary: await shifts.currentShift(db, c.get("ctx")) }))
  .post("/open", validate("json", shiftOpenInput), async (c) =>
    c.json(await shifts.openShift(db, c.get("ctx"), c.req.valid("json")), 201),
  )
  .post("/close", validate("json", shiftCloseInput), async (c) =>
    c.json(await shifts.closeShift(db, c.get("ctx"), c.req.valid("json"))),
  )
  .post("/movements", validate("json", cashMovementInput), async (c) =>
    c.json(await shifts.addCashMovement(db, c.get("ctx"), c.req.valid("json")), 201),
  )
  .get("/", validate("query", shiftListQuery), async (c) => {
    const user = c.get("user");
    return c.json(
      await shifts.listShifts(db, c.get("ctx"), c.req.valid("query"), {
        userId: isAdmin(user) ? undefined : user.id,
      }),
    );
  })
  .get("/:id", validate("param", idParam), async (c) => {
    const summary = await shifts.getShiftSummary(db, c.get("ctx"), c.req.valid("param").id);
    const user = c.get("user");
    if (!isAdmin(user) && summary.shift.openedById !== user.id) throw new AppError("NOT_FOUND");
    return c.json(summary);
  });
