import { asc, eq } from "drizzle-orm";
import {
  PLAN_FEATURES,
  type PlanFeature,
  type PlanInput,
  planInput,
  type PlanUpdateInput,
  planUpdateInput,
} from "@/lib/validators/platform";
import type { Executor } from "../db/client";
import { plans } from "../db/schema";
import { AppError, isUniqueViolation } from "../errors";
import type { Actor } from "./access";
import { recordAudit } from "./audit";

/** What a plan allows. null fields = unlimited. */
export type PlanLimits = {
  maxDevices: number | null;
  maxUsers: number | null;
  features: PlanFeature[];
};

export type Plan = Omit<typeof plans.$inferSelect, "features"> & { features: PlanFeature[] };

function parseFeatures(raw: string): PlanFeature[] {
  try {
    const list = JSON.parse(raw) as unknown;
    return Array.isArray(list)
      ? list.filter((f): f is PlanFeature => PLAN_FEATURES.includes(f as PlanFeature))
      : [];
  } catch {
    return [];
  }
}

const toPlan = (row: typeof plans.$inferSelect): Plan => ({
  ...row,
  features: parseFeatures(row.features),
});

export const planLimits = (p: Plan): PlanLimits => ({
  maxDevices: p.maxDevices,
  maxUsers: p.maxUsers,
  features: p.features,
});

export async function listPlans(db: Executor, opts: { activeOnly?: boolean } = {}) {
  const rows = await db
    .select()
    .from(plans)
    .where(opts.activeOnly ? eq(plans.active, true) : undefined)
    .orderBy(asc(plans.sortOrder), asc(plans.code));
  return rows.map(toPlan);
}

export async function getPlan(db: Executor, code: string | null | undefined) {
  if (!code) return null;
  const [row] = await db.select().from(plans).where(eq(plans.code, code));
  return row ? toPlan(row) : null;
}

/** Limits of a plan code; null (no limits) for unknown codes such as "trial". */
export async function limitsForPlan(db: Executor, code: string | null | undefined) {
  const plan = await getPlan(db, code);
  return plan ? planLimits(plan) : null;
}

export async function createPlan(db: Executor, actor: Actor, input: PlanInput) {
  const data = planInput.parse(input);
  try {
    const [row] = await db
      .insert(plans)
      .values({ ...data, features: JSON.stringify(data.features) })
      .returning();
    await recordAudit(db, actor, {
      action: "plan.create",
      targetType: "plan",
      targetId: row.id,
      details: { code: row.code },
    });
    return toPlan(row);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("NAME_TAKEN");
    throw err;
  }
}

export async function updatePlan(db: Executor, actor: Actor, code: string, input: PlanUpdateInput) {
  const data = planUpdateInput.parse(input);
  const before = await getPlan(db, code);
  if (!before) throw new AppError("NOT_FOUND");
  const [row] = await db
    .update(plans)
    .set({ ...data, features: JSON.stringify(data.features) })
    .where(eq(plans.code, code))
    .returning();
  const after = toPlan(row);
  const changed = (Object.keys(data) as (keyof typeof data)[]).filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]),
  );
  if (changed.length) {
    await recordAudit(db, actor, {
      action: "plan.update",
      targetType: "plan",
      targetId: row.id,
      details: { code, changed },
    });
  }
  return after;
}

/** Monthly value of a plan, to compare plans and convert unused days. */
export function monthlyValue(plan: Plan | null) {
  if (!plan) return null;
  if (plan.monthlyPrice) return plan.monthlyPrice;
  if (plan.yearlyPrice) return plan.yearlyPrice / 12;
  return null;
}
