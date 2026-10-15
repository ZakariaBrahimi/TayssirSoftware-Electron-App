import { and, count, desc, eq, type SQL } from "drizzle-orm";
import type { Executor } from "../db/client";
import { platformAudit } from "../db/schema";
import type { Actor } from "./access";

export type AuditEntry = {
  action: string;
  targetType?: string;
  targetId?: string | null;
  storeId?: string | null;
  details?: Record<string, unknown>;
};

export async function recordAudit(db: Executor, actor: Actor, entry: AuditEntry) {
  await db.insert(platformAudit).values({
    actorId: actor.id,
    actorName: actor.name,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    storeId: entry.storeId ?? null,
    details: entry.details ? JSON.stringify(entry.details) : null,
    ip: actor.ip ?? null,
  });
}

export async function listAudit(
  db: Executor,
  query: { action?: string; storeId?: string; targetId?: string; page: number; pageSize: number },
) {
  const filters: (SQL | undefined)[] = [
    query.action ? eq(platformAudit.action, query.action) : undefined,
    query.storeId ? eq(platformAudit.storeId, query.storeId) : undefined,
    query.targetId ? eq(platformAudit.targetId, query.targetId) : undefined,
  ];
  const where = and(...filters);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(platformAudit)
      .where(where)
      .orderBy(desc(platformAudit.createdAt), desc(platformAudit.id))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(platformAudit).where(where),
  ]);
  return {
    rows: rows.map((r) => ({
      ...r,
      details: r.details ? (JSON.parse(r.details) as Record<string, unknown>) : null,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}
