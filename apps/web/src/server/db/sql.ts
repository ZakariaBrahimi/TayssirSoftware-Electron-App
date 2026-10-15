import { sql } from "drizzle-orm";

/**
 * Fully qualified column reference ("table"."column"). Needed inside
 * correlated subqueries: drizzle renders columns unqualified in
 * single-table queries, where "id" would bind to the subquery's table.
 */
export const col = (table: string, column: string) =>
  sql.raw(`"${table.replace(/"/g, "")}"."${column.replace(/"/g, "")}"`);
