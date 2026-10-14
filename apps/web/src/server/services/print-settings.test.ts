import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LABEL_SETTINGS,
  DEFAULT_RECEIPT_SETTINGS,
  labelSize,
  printSettingsInput,
} from "@/lib/print-settings";
import { makeDb, makeStore } from "@/test/helpers";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { stores } from "../db/schema";
import { getStore, publicStore, updatePrintSettings } from "./stores";

let db: Database;
let ctx: Ctx;

beforeEach(async () => {
  db = await makeDb();
  ({ ctx } = await makeStore(db));
});

describe("print settings", () => {
  it("start from the defaults and save the shop's designs and logo", async () => {
    const before = publicStore(await getStore(db, ctx.storeId));
    expect(before.labels).toEqual(DEFAULT_LABEL_SETTINGS);
    expect(before.receipt).toMatchObject({ paper: "80", autoPrint: "ask", copies: 1 });

    const logo = "data:image/png;base64,iVBORw0KGgo=";
    const input = printSettingsInput.parse({
      labels: {
        ...DEFAULT_LABEL_SETTINGS,
        layout: "sheet",
        columns: 3,
        rows: 8,
        showShopName: true,
      },
      receipt: {
        ...DEFAULT_RECEIPT_SETTINGS,
        paper: "58",
        copies: 2,
        qrUrl: "https://instagram.com/shop",
      },
      logo,
    });
    const after = publicStore(await updatePrintSettings(db, ctx.storeId, input));
    expect(after.labels).toMatchObject({ layout: "sheet", showShopName: true });
    expect(after.receipt).toMatchObject({ paper: "58", copies: 2 });
    expect(after.logo).toBe(logo);
    // A 3 × 8 sheet: 3 labels of about 63 × 34 mm per row.
    expect(Math.round(labelSize(after.labels).width)).toBe(63);

    // Saving without a logo keeps it; null removes it.
    await updatePrintSettings(db, ctx.storeId, { ...input, logo: undefined });
    expect((await getStore(db, ctx.storeId)).logo).toBe(logo);
    await updatePrintSettings(db, ctx.storeId, { ...input, logo: null });
    expect((await getStore(db, ctx.storeId)).logo).toBeNull();
  });

  it("falls back to the defaults for broken saved designs and rejects bad input", async () => {
    await db
      .update(stores)
      .set({ labelSettings: "{oops", receiptSettings: '{"paper":"a3"}' })
      .where(eq(stores.id, ctx.storeId));
    const s = publicStore(await getStore(db, ctx.storeId));
    expect(s.labels).toEqual(DEFAULT_LABEL_SETTINGS);
    expect(s.receipt).toEqual(DEFAULT_RECEIPT_SETTINGS);

    const bad = (patch: object) =>
      printSettingsInput.safeParse({
        labels: DEFAULT_LABEL_SETTINGS,
        receipt: DEFAULT_RECEIPT_SETTINGS,
        ...patch,
      }).success;
    expect(bad({ logo: "javascript:alert(1)" })).toBe(false);
    expect(bad({ receipt: { ...DEFAULT_RECEIPT_SETTINGS, qrUrl: "javascript:alert(1)" } })).toBe(
      false,
    );
    expect(bad({ labels: { ...DEFAULT_LABEL_SETTINGS, width: 500 } })).toBe(false);
  });
});
