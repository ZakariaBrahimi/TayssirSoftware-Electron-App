import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { customerInput, saleCreateInput } from "@/lib/validators";
import { makeDb, makeProduct, makeStore } from "@/test/helpers";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { changes, products, sales, stores } from "../db/schema";
import { createCustomer, getCustomer } from "../services/customers";
import { getProduct, updateProduct } from "../services/products";
import { createSale } from "../services/sales";
import { applyChanges, collectChanges, enqueueAll, rehomeStore } from "./engine";

/**
 * A cloud database and two desktop installs. Each desktop keeps a push and
 * a pull cursor, exactly like the HTTP client does.
 */
type Node = { db: Database; ctx: Ctx; push: number; pull: number };

async function push(node: Node, cloud: Database, storeId: string) {
  for (;;) {
    const batch = await collectChanges(node.db, { since: node.push, limit: 50 });
    if (batch.changes.length)
      await applyChanges(cloud, storeId, batch.changes, { suppressLog: false });
    node.push = batch.cursor;
    if (!batch.hasMore) break;
  }
}

async function pull(node: Node, cloud: Database, storeId: string) {
  for (;;) {
    const batch = await collectChanges(cloud, { since: node.pull, storeId, limit: 50 });
    if (batch.changes.length)
      await applyChanges(node.db, storeId, batch.changes, { suppressLog: true });
    node.pull = batch.cursor;
    if (!batch.hasMore) break;
  }
}

const sync = async (node: Node, cloud: Database, storeId: string) => {
  await push(node, cloud, storeId);
  await pull(node, cloud, storeId);
};

const sale = (input: unknown) => saleCreateInput.parse(input);

let cloud: Database;
let cloudCtx: Ctx;
let a: Node;
let b: Node;

async function stockOn(db: Database, id: string) {
  const [row] = await db
    .select({ stock: products.stock })
    .from(products)
    .where(eq(products.id, id));
  return row?.stock;
}

beforeEach(async () => {
  cloud = await makeDb();
  ({ ctx: cloudCtx } = await makeStore(cloud, "Cloud store"));

  // Two desktops, each started offline with its own local store…
  a = { db: await makeDb(), ctx: undefined as unknown as Ctx, push: 0, pull: 0 };
  b = { db: await makeDb(), ctx: undefined as unknown as Ctx, push: 0, pull: 0 };
  for (const node of [a, b]) {
    const { store, ctx } = await makeStore(node.db, "Local store");
    // …then linked to the cloud store (what sync/client.ts `link` does).
    await rehomeStore(node.db, store.id, cloudCtx.storeId);
    await node.db.delete(changes);
    await enqueueAll(node.db, cloudCtx.storeId);
    node.ctx = { ...ctx, storeId: cloudCtx.storeId };
  }
});

describe("sync", () => {
  it("replicates the catalog from one desktop to the other", async () => {
    const product = await makeProduct(a.db, a.ctx, { stock: 10, name: "Coffee" });
    await sync(a, cloud, cloudCtx.storeId);
    await sync(b, cloud, cloudCtx.storeId);
    const onB = await getProduct(b.db, b.ctx, product.id);
    expect(onB.name).toBe("Coffee");
    expect(onB.stock).toBe(10);
    // The cloud's store settings win over the desktops' local ones.
    const [storeOnB] = await b.db.select().from(stores);
    expect(storeOnB.name).toBe("Cloud store");
  });

  it("merges offline sales of the same product from two tills", async () => {
    const product = await makeProduct(a.db, a.ctx, { stock: 10 });
    await sync(a, cloud, cloudCtx.storeId);
    await sync(b, cloud, cloudCtx.storeId);

    // Both tills sell while offline.
    await createSale(a.db, a.ctx, sale({ items: [{ productId: product.id, quantity: 3 }] }), {
      deviceCode: "D1",
    });
    await createSale(b.db, b.ctx, sale({ items: [{ productId: product.id, quantity: 2 }] }), {
      deviceCode: "D2",
    });
    expect(await stockOn(a.db, product.id)).toBe(7);
    expect(await stockOn(b.db, product.id)).toBe(8);

    for (const node of [a, b, a]) await sync(node, cloud, cloudCtx.storeId);

    // Stock is derived from the merged movements: 10 − 3 − 2 everywhere.
    expect(await stockOn(cloud, product.id)).toBe(5);
    expect(await stockOn(a.db, product.id)).toBe(5);
    expect(await stockOn(b.db, product.id)).toBe(5);
    const numbers = (await a.db.select({ d: sales.deviceCode, s: sales.seq }).from(sales)).map(
      (r) => `${r.d}-${r.s}`,
    );
    expect(numbers.sort()).toEqual(["D1-1", "D2-1"]);
  });

  it("keeps the latest edit and does not let stock changes override it", async () => {
    const product = await makeProduct(a.db, a.ctx, { stock: 10, name: "Old name" });
    await sync(a, cloud, cloudCtx.storeId);
    await sync(b, cloud, cloudCtx.storeId);

    // B renames the product; A only sells it afterwards (a stock change).
    await updateProduct(b.db, b.ctx, product.id, { name: "New name" });
    await createSale(a.db, a.ctx, sale({ items: [{ productId: product.id, quantity: 1 }] }), {
      deviceCode: "D1",
    });
    for (const node of [b, a, b]) await sync(node, cloud, cloudCtx.storeId);

    expect((await getProduct(a.db, a.ctx, product.id)).name).toBe("New name");
    expect((await getProduct(cloud, cloudCtx, product.id)).name).toBe("New name");
    expect((await getProduct(b.db, b.ctx, product.id)).stock).toBe(9);
  });

  it("merges customer debts and does not echo pulled changes back", async () => {
    const product = await makeProduct(a.db, a.ctx, { stock: 10, salePrice: 1000 });
    const customer = await createCustomer(a.db, a.ctx, customerInput.parse({ name: "Karim" }));
    await sync(a, cloud, cloudCtx.storeId);
    await sync(b, cloud, cloudCtx.storeId);
    await createSale(
      b.db,
      b.ctx,
      sale({
        items: [{ productId: product.id, quantity: 2 }],
        customerId: customer.id,
        paymentMethod: "credit",
      }),
      { deviceCode: "D2" },
    );
    await sync(b, cloud, cloudCtx.storeId);
    await sync(a, cloud, cloudCtx.storeId);
    expect((await getCustomer(a.db, a.ctx, customer.id)).balance).toBe(2000);

    // Applying pulled rows wrote nothing to A's own change log.
    const pending = await collectChanges(a.db, { since: a.push });
    expect(pending.changes).toHaveLength(0);
  });

  it("rejects rows of another store and ignores protected columns", async () => {
    const { ctx: other } = await makeStore(cloud, "Someone else");
    const foreign = await makeProduct(cloud, other, { name: "Not yours" });
    const row = {
      ...(
        await cloud.all<Record<string, unknown>>(
          sql`select * from products where id = ${foreign.id}`,
        )
      )[0],
    };

    await expect(
      applyChanges(
        cloud,
        cloudCtx.storeId,
        [{ tbl: "products", row: { ...row, name: "Hacked", updated_at: Date.now() + 1e6 } }],
        {
          suppressLog: false,
        },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Even claiming to be our store, an existing row of another store is untouched.
    await applyChanges(
      cloud,
      cloudCtx.storeId,
      [
        {
          tbl: "products",
          row: { ...row, store_id: cloudCtx.storeId, name: "Hacked", updated_at: Date.now() + 1e6 },
        },
      ],
      { suppressLog: false },
    );
    expect((await getProduct(cloud, other, foreign.id)).name).toBe("Not yours");

    // A desktop cannot grant itself a subscription.
    const [storeRow] = await cloud.all<Record<string, unknown>>(
      sql`select * from stores where id = ${cloudCtx.storeId}`,
    );
    await applyChanges(
      cloud,
      cloudCtx.storeId,
      [
        {
          tbl: "stores",
          row: {
            ...storeRow,
            subscription_status: "active",
            name: "Renamed",
            updated_at: Date.now() + 1e6,
          },
        },
      ],
      { suppressLog: false },
    );
    const [after] = await cloud.select().from(stores).where(eq(stores.id, cloudCtx.storeId));
    expect(after.name).toBe("Renamed");
    expect(after.subscriptionStatus).toBe("trialing");

    await expect(
      applyChanges(cloud, cloudCtx.storeId, [{ tbl: "user", row: { id: "x", updated_at: 1 } }], {
        suppressLog: false,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("has change-log triggers on every synced table", async () => {
    const triggers = await cloud.all<{ name: string }>(
      sql`select name from sqlite_master where type = 'trigger'`,
    );
    const { SYNC_TABLES } = await import("../db/schema");
    for (const tbl of Object.keys(SYNC_TABLES)) {
      expect(triggers.map((t) => t.name)).toEqual(
        expect.arrayContaining([`sync_${tbl}_ins`, `sync_${tbl}_upd`]),
      );
    }
  });
});
