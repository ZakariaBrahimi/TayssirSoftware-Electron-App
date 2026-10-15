import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb, makeProduct, makeStore } from "@/test/helpers";
import type { Ctx } from "../context";
import type { Database } from "../db/client";
import { alertChannels, alertSettings } from "../db/schema";
import {
  alertOverview,
  createTelegramLink,
  handleTelegramUpdate,
  localClock,
  runDueDigests,
  sendDigest,
  updateAlertSettings,
} from "./service";

let db: Database;
let ctx: Ctx;

beforeEach(async () => {
  db = await makeDb();
  ({ ctx } = await makeStore(db, "Superette Baraka"));
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:test");
  vi.stubEnv("TELEGRAM_BOT_USERNAME", "MizanAlertsBot");
  vi.stubEnv("BETTER_AUTH_URL", "https://app.example.com");
});

const senders = () => ({
  telegram: vi.fn(async (_chatId: string, _html: string) => {}),
  email: vi.fn(async (_to: string, _subject: string, _html: string, _text: string) => {}),
});

describe("stock summaries", () => {
  it("links a Telegram chat with a one-time code", async () => {
    const { url } = await createTelegramLink(db, ctx.storeId);
    expect(url).toMatch(/^https:\/\/t\.me\/MizanAlertsBot\?start=[\w-]{16}$/);
    const code = new URL(url).searchParams.get("start")!;
    const send = vi.fn(async () => {});

    // Wrong or expired codes link nothing.
    await handleTelegramUpdate(
      db,
      { message: { text: "/start nope", chat: { id: 1 } } },
      Date.now(),
      send,
    );
    expect((await alertOverview(db, ctx.storeId)).channels).toHaveLength(0);

    const reply = await handleTelegramUpdate(
      db,
      { message: { text: `/start ${code}`, chat: { id: 4242 }, from: { first_name: "Karim" } } },
      Date.now(),
      send,
    );
    expect(reply).toContain("Superette Baraka");
    const overview = await alertOverview(db, ctx.storeId);
    expect(overview.channels).toMatchObject([{ kind: "telegram", label: "Karim", address: null }]);

    // The code works once.
    await handleTelegramUpdate(
      db,
      { message: { text: `/start ${code}`, chat: { id: 7 } } },
      Date.now(),
      send,
    );
    expect((await alertOverview(db, ctx.storeId)).channels).toHaveLength(1);

    // /stop disconnects the chat.
    await handleTelegramUpdate(
      db,
      { message: { text: "/stop", chat: { id: 4242 } } },
      Date.now(),
      send,
    );
    expect((await alertOverview(db, ctx.storeId)).channels).toHaveLength(0);
  });

  it("sends a summary only when products need attention", async () => {
    await db
      .insert(alertChannels)
      .values({ storeId: ctx.storeId, kind: "telegram", address: "99" });
    await db
      .insert(alertChannels)
      .values({ storeId: ctx.storeId, kind: "email", address: "o@shop.dz" });
    await makeProduct(db, ctx, { name: "Lait <1L>", stock: 50 });

    const s = senders();
    expect(await sendDigest(db, ctx.storeId, { senders: s })).toMatchObject({ sent: 0, alerts: 0 });
    expect(s.telegram).not.toHaveBeenCalled();

    await makeProduct(db, ctx, { name: "Pain & co", stock: 0 });
    expect(await sendDigest(db, ctx.storeId, { senders: s })).toMatchObject({ sent: 2, alerts: 1 });
    const [chat, html] = s.telegram.mock.calls[0];
    expect(chat).toBe("99");
    expect(html).toContain("Pain &amp; co"); // escaped for Telegram HTML
    expect(html).toContain("https://app.example.com/fr/reorder");
    const [to, subject] = s.email.mock.calls[0];
    expect(to).toBe("o@shop.dz");
    expect(subject).toContain("Superette Baraka");
  });

  it("removes chats that blocked the bot", async () => {
    await db.insert(alertChannels).values({ storeId: ctx.storeId, kind: "telegram", address: "5" });
    await makeProduct(db, ctx, { stock: 0 });
    const s = senders();
    s.telegram.mockRejectedValueOnce(
      Object.assign(new Error("Forbidden: bot was blocked"), { code: 403 }),
    );
    expect((await sendDigest(db, ctx.storeId, { senders: s })).sent).toBe(0);
    expect(await db.select().from(alertChannels)).toHaveLength(0);
  });

  it("sends each store's summary once a day, from its hour", async () => {
    await updateAlertSettings(db, ctx.storeId, { enabled: true, digestHour: 8, locale: "ar" });
    await db.insert(alertChannels).values({ storeId: ctx.storeId, kind: "telegram", address: "1" });
    await makeProduct(db, ctx, { stock: 0 });
    const s = senders();
    // 06:30 UTC = 07:30 in Algiers: too early.
    const early = Date.parse("2026-10-15T06:30:00Z");
    expect(localClock(early)).toEqual({ date: "2026-10-15", hour: 7 });
    expect((await runDueDigests(db, early, s)).sent).toBe(0);
    // 08:10 in Algiers: sent, once.
    const due = Date.parse("2026-10-15T07:10:00Z");
    expect((await runDueDigests(db, due, s)).sent).toBe(1);
    expect((await runDueDigests(db, due + 600_000, s)).sent).toBe(0);
    expect(s.telegram.mock.calls[0][1]).toContain("خلاصة المخزون");
    const [row] = await db
      .select()
      .from(alertSettings)
      .where(eq(alertSettings.storeId, ctx.storeId));
    expect(row.lastSentOn).toBe("2026-10-15");
    // Next day again.
    expect((await runDueDigests(db, due + 86_400_000, s)).sent).toBe(1);
  });
});
