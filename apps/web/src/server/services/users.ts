import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { z } from "zod";
import type { userCreateInput, UserUpdateInput } from "@/lib/validators";
import { auth } from "../auth";
import type { Ctx } from "../context";
import type { Executor } from "../db/client";
import { account, user } from "../db/schema";
import { AppError } from "../errors";

const publicColumns = {
  id: user.id,
  name: user.name,
  username: user.username,
  displayUsername: user.displayUsername,
  role: user.role,
  createdAt: user.createdAt,
};

export async function listUsers(db: Executor, ctx: Ctx) {
  return db
    .select(publicColumns)
    .from(user)
    .where(eq(user.storeId, ctx.storeId))
    .orderBy(asc(user.name));
}

async function getUser(db: Executor, ctx: Ctx, id: string) {
  const [row] = await db
    .select(publicColumns)
    .from(user)
    .where(and(eq(user.id, id), eq(user.storeId, ctx.storeId)));
  if (!row) throw new AppError("NOT_FOUND");
  return row;
}

/** Creates a user in a store. Usernames are unique across the platform. */
export async function createStoreUser(
  db: Executor,
  storeId: string,
  input: z.output<typeof userCreateInput>,
) {
  const username = input.username.toLowerCase();
  const [taken] = await db.select({ id: user.id }).from(user).where(eq(user.username, username));
  if (taken) throw new AppError("USERNAME_TAKEN");

  const { user: created } = await auth.api.createUser({
    body: {
      name: input.name,
      // Better Auth requires an email; staff sign in with their username.
      email: `${username}@users.tayssir.local`,
      password: input.password,
      role: input.role,
      data: { username, displayUsername: input.username, storeId },
    },
  });
  return created.id;
}

export async function createUser(db: Executor, ctx: Ctx, input: z.output<typeof userCreateInput>) {
  const id = await createStoreUser(db, ctx.storeId, input);
  return getUser(db, ctx, id);
}

export async function updateUser(db: Executor, ctx: Ctx, id: string, input: UserUpdateInput) {
  await getUser(db, ctx, id);
  if (id === ctx.userId && input.role && input.role !== "admin") {
    // Prevent administrators from locking themselves out.
    throw new AppError("FORBIDDEN");
  }
  if (input.name || input.role) {
    await db
      .update(user)
      .set({ ...(input.name ? { name: input.name } : {}), ...(input.role ? { role: input.role } : {}) })
      .where(eq(user.id, id));
  }
  if (input.password) {
    const authCtx = await auth.$context;
    await authCtx.internalAdapter.updatePassword(id, await authCtx.password.hash(input.password));
  }
  return getUser(db, ctx, id);
}

export async function deleteUser(db: Executor, ctx: Ctx, id: string) {
  if (id === ctx.userId) throw new AppError("FORBIDDEN");
  await getUser(db, ctx, id);
  const authCtx = await auth.$context;
  await authCtx.internalAdapter.deleteUserSessions(id);
  await authCtx.internalAdapter.deleteUser(id);
  return { id };
}

/** Checks a username/password pair without creating a session. */
export async function verifyCredentials(db: Executor, username: string, password: string) {
  const [row] = await db
    .select({ id: user.id, name: user.name, role: user.role, storeId: user.storeId, hash: account.password })
    .from(user)
    .innerJoin(account, and(eq(account.userId, user.id), eq(account.providerId, "credential")))
    .where(eq(user.username, username.trim().toLowerCase()));
  if (!row?.hash) return null;
  const authCtx = await auth.$context;
  const ok = await authCtx.password.verify({ password, hash: row.hash });
  return ok ? { id: row.id, name: row.name, role: row.role, storeId: row.storeId } : null;
}
