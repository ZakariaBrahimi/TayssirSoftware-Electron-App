import { randomBytes } from "node:crypto";
import { and, eq, gt, isNotNull, isNull, ne, or } from "drizzle-orm";
import type { Executor } from "../db/client";
import { alertChannels, alertSettings, pushDevices, stores } from "../db/schema";
import { AppError } from "../errors";
import { stockAlerts } from "../services/forecast";
import { type DigestLocale, buildDigest } from "./digest";
import { emailAvailable, sendEmail } from "./email";
import { PushGoneError, pushAvailable, sendPush } from "./push";
import { botUsername, escapeHtml, isChatGone, sendTelegram, telegramAvailable } from "./telegram";

/*
 * Daily stock summaries for cloud stores (and desktops linked to them,
 * whose data is in the cloud). Each store picks an hour; the scheduler
 * sends one summary a day, only when something needs attention.
 */

const LINK_TTL_MS = 30 * 60_000;
export const DIGEST_TIME_ZONE = () => process.env.DIGEST_TIME_ZONE || "Africa/Algiers";

/** Local date (yyyy-mm-dd) and hour in the summaries' time zone. */
export function localClock(now: number, timeZone = DIGEST_TIME_ZONE()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export async function getAlertSettings(db: Executor, storeId: string) {
  const [row] = await db.select().from(alertSettings).where(eq(alertSettings.storeId, storeId));
  if (row) return row;
  const [created] = await db
    .insert(alertSettings)
    .values({ storeId })
    .onConflictDoNothing()
    .returning();
  return (
    created ?? (await db.select().from(alertSettings).where(eq(alertSettings.storeId, storeId)))[0]
  );
}

export async function updateAlertSettings(
  db: Executor,
  storeId: string,
  input: { enabled: boolean; digestHour: number; locale: DigestLocale },
) {
  await getAlertSettings(db, storeId);
  const [row] = await db
    .update(alertSettings)
    .set(input)
    .where(eq(alertSettings.storeId, storeId))
    .returning();
  return row;
}

/** Connected channels (pending Telegram links are left out). */
export function listChannels(db: Executor, storeId: string) {
  return db
    .select({
      id: alertChannels.id,
      kind: alertChannels.kind,
      address: alertChannels.address,
      label: alertChannels.label,
      createdAt: alertChannels.createdAt,
    })
    .from(alertChannels)
    .where(and(eq(alertChannels.storeId, storeId), isNotNull(alertChannels.address)))
    .orderBy(alertChannels.createdAt);
}

/** Everything the settings page shows. */
/** Phones of the store with the Android app (push notifications). */
export function listDevices(db: Executor, storeId: string) {
  return db
    .select({ id: pushDevices.id, token: pushDevices.token })
    .from(pushDevices)
    .where(eq(pushDevices.storeId, storeId));
}

/** Registers (or moves) a phone's push token for a store and user. */
export async function registerDevice(
  db: Executor,
  input: { storeId: string; userId: string; token: string; platform: string },
) {
  await db
    .insert(pushDevices)
    .values(input)
    .onConflictDoUpdate({
      target: pushDevices.token,
      set: {
        storeId: input.storeId,
        userId: input.userId,
        platform: input.platform,
        updatedAt: new Date(),
      },
    });
  return { ok: true };
}

export async function unregisterDevice(db: Executor, token: string) {
  await db.delete(pushDevices).where(eq(pushDevices.token, token));
  return { ok: true };
}

export async function alertOverview(db: Executor, storeId: string) {
  const [settings, channels, devices] = await Promise.all([
    getAlertSettings(db, storeId),
    listChannels(db, storeId),
    listDevices(db, storeId),
  ]);
  return {
    settings: {
      enabled: settings.enabled,
      digestHour: settings.digestHour,
      locale: settings.locale as DigestLocale,
      lastSentOn: settings.lastSentOn,
    },
    timeZone: DIGEST_TIME_ZONE(),
    channels: channels.map((c) => ({
      ...c,
      // Chat ids mean nothing to people: show the Telegram name instead.
      address: c.kind === "telegram" ? null : c.address,
    })),
    telegram: telegramAvailable(),
    email: emailAvailable(),
    push: pushAvailable(),
    phones: devices.length,
  };
}

/**
 * Starts linking a Telegram chat: returns a t.me link carrying a one-time
 * code. Opening it and pressing Start sends "/start <code>" to the bot.
 */
export async function createTelegramLink(db: Executor, storeId: string, now = Date.now()) {
  if (!telegramAvailable()) throw new AppError("NOT_AVAILABLE");
  const code = randomBytes(12).toString("base64url");
  await db.insert(alertChannels).values({
    storeId,
    kind: "telegram",
    linkCode: code,
    linkExpiresAt: new Date(now + LINK_TTL_MS),
  });
  return { url: `https://t.me/${await botUsername()}?start=${code}` };
}

type TelegramUpdate = {
  message?: {
    text?: string;
    chat: { id: number | string; type?: string; title?: string };
    from?: { first_name?: string; last_name?: string; username?: string };
  };
};

/** Handles a message sent to the bot (webhook). Returns the reply sent. */
export async function handleTelegramUpdate(
  db: Executor,
  update: TelegramUpdate,
  now = Date.now(),
  send: (chatId: string, html: string) => Promise<unknown> = sendTelegram,
) {
  const msg = update.message;
  if (!msg?.text) return null;
  const chatId = String(msg.chat.id);
  const [command, arg] = msg.text.trim().split(/\s+/, 2);
  let reply: string;

  if (command === "/start" && arg) {
    const [pending] = await db
      .select({ id: alertChannels.id, storeId: alertChannels.storeId, storeName: stores.name })
      .from(alertChannels)
      .innerJoin(stores, eq(stores.id, alertChannels.storeId))
      .where(and(eq(alertChannels.linkCode, arg), gt(alertChannels.linkExpiresAt, new Date(now))));
    if (!pending) {
      reply =
        "This link has expired. Open Mizan → Settings → Notifications and connect Telegram again.\n\nانتهت صلاحية هذا الرابط. افتح ميزان ← الإعدادات ← الإشعارات وأعد ربط تيليغرام.";
    } else {
      const label =
        msg.chat.title ??
        ([msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") ||
          (msg.from?.username ? `@${msg.from.username}` : "Telegram"));
      // One link per chat and store.
      await db
        .delete(alertChannels)
        .where(
          and(
            eq(alertChannels.storeId, pending.storeId),
            eq(alertChannels.kind, "telegram"),
            eq(alertChannels.address, chatId),
          ),
        );
      await db
        .update(alertChannels)
        .set({ address: chatId, label, linkCode: null, linkExpiresAt: null })
        .where(eq(alertChannels.id, pending.id));
      reply = `✅ <b>${escapeHtml(pending.storeName)}</b>\nConnected: you will get the daily stock summary here.\nConnecté : vous recevrez ici le résumé quotidien du stock.\nتم الربط: ستصلك هنا خلاصة المخزون اليومية.\n\n/stop`;
    }
  } else if (command === "/stop") {
    const removed = await db
      .delete(alertChannels)
      .where(and(eq(alertChannels.kind, "telegram"), eq(alertChannels.address, chatId)))
      .returning({ id: alertChannels.id });
    reply = removed.length
      ? "Stopped: no more summaries in this chat.\nArrêté : plus de résumés ici.\nتم الإيقاف: لن تصل خلاصات بعد الآن."
      : "This chat is not connected to a shop.";
  } else {
    reply =
      "Connect this chat from Mizan → Settings → Notifications → Telegram.\nReliez ce chat depuis Mizan → Paramètres → Notifications → Telegram.\nاربط هذه المحادثة من ميزان ← الإعدادات ← الإشعارات ← تيليغرام.";
  }
  await send(chatId, reply).catch(() => {});
  return reply;
}

export async function addEmailChannel(db: Executor, storeId: string, address: string) {
  if (!emailAvailable()) throw new AppError("NOT_AVAILABLE");
  const email = address.trim().toLowerCase();
  const [existing] = await db
    .select({ id: alertChannels.id })
    .from(alertChannels)
    .where(
      and(
        eq(alertChannels.storeId, storeId),
        eq(alertChannels.kind, "email"),
        eq(alertChannels.address, email),
      ),
    );
  if (existing) return existing;
  const [row] = await db
    .insert(alertChannels)
    .values({ storeId, kind: "email", address: email })
    .returning({ id: alertChannels.id });
  return row;
}

export async function removeChannel(db: Executor, storeId: string, id: string) {
  const removed = await db
    .delete(alertChannels)
    .where(and(eq(alertChannels.id, id), eq(alertChannels.storeId, storeId)))
    .returning({ id: alertChannels.id });
  if (!removed.length) throw new AppError("NOT_FOUND");
  return { ok: true };
}

export type Senders = {
  telegram: (chatId: string, html: string) => Promise<unknown>;
  email: (to: string, subject: string, html: string, text: string) => Promise<unknown>;
  push?: (
    token: string,
    message: { title: string; body: string; url?: string },
  ) => Promise<unknown>;
};
const defaultSenders: Senders = { telegram: sendTelegram, email: sendEmail, push: sendPush };

const appUrl = () => process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || null;

/**
 * Sends a store's summary to all its channels. Without `force`, nothing is
 * sent when every product is fine. Returns how many channels got it.
 */
export async function sendDigest(
  db: Executor,
  storeId: string,
  opts: { force?: boolean; now?: number; senders?: Senders } = {},
) {
  const senders = opts.senders ?? defaultSenders;
  const [store] = await db.select({ name: stores.name }).from(stores).where(eq(stores.id, storeId));
  if (!store) throw new AppError("NOT_FOUND");
  const canPush = Boolean(senders.push) && (opts.senders ? true : pushAvailable());
  const [settings, channels, devices] = await Promise.all([
    getAlertSettings(db, storeId),
    listChannels(db, storeId),
    canPush ? listDevices(db, storeId) : Promise.resolve([]),
  ]);
  const targets = channels.length + devices.length;
  if (!targets) return { sent: 0, channels: 0, alerts: 0 };
  const alerts = await stockAlerts(db, { storeId }, opts.now);
  if (!alerts.summary.total && !opts.force) return { sent: 0, channels: targets, alerts: 0 };

  const locale = settings.locale as DigestLocale;
  const base = appUrl();
  const digest = buildDigest({
    storeName: store.name,
    alerts,
    locale,
    reorderUrl: base ? `${base}/${locale}/reorder` : null,
  });

  let sent = 0;
  for (const ch of channels) {
    try {
      if (ch.kind === "telegram") await senders.telegram(ch.address!, digest.telegram);
      else await senders.email(ch.address!, digest.subject, digest.html, digest.text);
      sent++;
    } catch (err) {
      // A chat that blocked the bot or was deleted is removed for good.
      if (ch.kind === "telegram" && isChatGone(err)) {
        await db.delete(alertChannels).where(eq(alertChannels.id, ch.id));
      } else {
        console.error(`[alerts] ${ch.kind} summary failed for store ${storeId}:`, err);
      }
    }
  }
  // Phones with the app: a short notification that opens the reorder page.
  for (const device of devices) {
    try {
      await senders.push!(device.token, {
        title: store.name,
        body: digest.subject,
        url: `/${locale}/reorder`,
      });
      sent++;
    } catch (err) {
      if (err instanceof PushGoneError) {
        await db.delete(pushDevices).where(eq(pushDevices.id, device.id));
      } else {
        console.error(`[alerts] push summary failed for store ${storeId}:`, err);
      }
    }
  }
  return { sent, channels: targets, alerts: alerts.summary.total };
}

/**
 * Sends today's summaries that are due. Each store is claimed with a
 * conditional update first, so two server instances never both send it.
 */
export async function runDueDigests(db: Executor, now = Date.now(), senders?: Senders) {
  const { date, hour } = localClock(now);
  const due = await db
    .select({ storeId: alertSettings.storeId, digestHour: alertSettings.digestHour })
    .from(alertSettings)
    .where(
      and(
        eq(alertSettings.enabled, true),
        or(isNull(alertSettings.lastSentOn), ne(alertSettings.lastSentOn, date)),
      ),
    );
  let sent = 0;
  for (const row of due) {
    if (hour < row.digestHour) continue;
    const claimed = await db
      .update(alertSettings)
      .set({ lastSentOn: date })
      .where(
        and(
          eq(alertSettings.storeId, row.storeId),
          or(isNull(alertSettings.lastSentOn), ne(alertSettings.lastSentOn, date)),
        ),
      )
      .returning({ storeId: alertSettings.storeId });
    if (!claimed.length) continue;
    try {
      sent += (await sendDigest(db, row.storeId, { now, senders })).sent;
    } catch (err) {
      console.error(`[alerts] summary failed for store ${row.storeId}:`, err);
    }
  }
  return { checked: due.length, sent };
}

let timer: ReturnType<typeof setInterval> | null = null;

/** Checks every 10 minutes for summaries to send (cloud server). */
export function startAlertScheduler(db: Executor) {
  if (timer) return;
  const tick = () => void runDueDigests(db).catch((err) => console.error("[alerts]", err));
  timer = setInterval(tick, 10 * 60_000);
  timer.unref?.();
  setTimeout(tick, 30_000).unref?.();
}
