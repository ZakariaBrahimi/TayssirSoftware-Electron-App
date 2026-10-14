import { createHmac } from "node:crypto";
import { authSecret } from "../env";

/*
 * Telegram bot used for daily stock summaries. One bot serves every store:
 * the platform owner creates it with @BotFather and sets
 * TELEGRAM_BOT_TOKEN (and optionally TELEGRAM_BOT_USERNAME) on the server.
 */

const API = "https://api.telegram.org";

export const telegramToken = () => process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
export const telegramAvailable = () => telegramToken() !== null;

/** Secret Telegram sends back on every webhook call (derived, not stored). */
export const webhookSecret = () =>
  createHmac("sha256", authSecret()).update("telegram-webhook").digest("hex").slice(0, 48);

async function call<T>(method: string, body: unknown): Promise<T> {
  const token = telegramToken();
  if (!token) throw new Error("Telegram is not configured");
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => null)) as
    { ok: true; result: T } | { ok: false; error_code?: number; description?: string } | null;
  if (!data?.ok) {
    const err = new Error(data && "description" in data ? data.description : `HTTP ${res.status}`);
    (err as Error & { code?: number }).code =
      data && "error_code" in data ? data.error_code : res.status;
    throw err;
  }
  return data.result;
}

let username: string | null = null;

/** The bot's @username, for t.me links. */
export async function botUsername() {
  if (process.env.TELEGRAM_BOT_USERNAME) return process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, "");
  if (!username) username = (await call<{ username: string }>("getMe", {})).username;
  return username;
}

export function sendTelegram(chatId: string, html: string) {
  return call("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

/** Points the bot at this server; called at start-up. */
export function setTelegramWebhook(baseUrl: string) {
  return call("setWebhook", {
    url: `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`,
    secret_token: webhookSecret(),
    allowed_updates: ["message"],
  });
}

/** True when Telegram says the chat is gone (bot blocked, chat deleted). */
export const isChatGone = (err: unknown) => {
  const code = (err as { code?: number }).code;
  return code === 403 || code === 400;
};

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
