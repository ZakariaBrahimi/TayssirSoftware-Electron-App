import { z } from "zod";
import { platformSettingsInput } from "@/lib/validators/platform";
import type { Executor } from "../db/client";
import { getMeta, setMeta } from "../services/meta";
import { TRIAL_DAYS } from "../services/stores";
import type { Actor } from "./access";
import { recordAudit } from "./audit";

/** What the landing page and sign-up show, editable in the platform console. */
export type PlatformSettings = z.output<typeof platformSettingsInput>;

export const DEFAULT_SETTINGS: PlatformSettings = {
  trialDays: TRIAL_DAYS,
  downloadUrl: "https://github.com/ZakariaBrahimi/TayssirSoftware-Electron-App/releases/latest",
  contactPhone: "",
  contactWhatsapp: "",
  contactEmail: "",
  payeeName: "",
  ccpAccount: "",
  ripAccount: "",
  bankRib: "",
  paymentNote: "",
};

/**
 * Saved settings over the defaults (a missing or invalid field keeps its
 * default). Not cached: it is one key lookup, and pages and API routes run
 * in separate module instances, so a cache would show stale values.
 */
export async function getPlatformSettings(db: Executor) {
  const raw = await getMeta(db, "platform.settings");
  let saved: Record<string, unknown> = {};
  try {
    saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    saved = {};
  }
  const value = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof PlatformSettings)[]) {
    const parsed = platformSettingsInput.shape[key].safeParse(saved[key]);
    if (parsed.success) (value as Record<string, unknown>)[key] = parsed.data;
  }
  return value;
}

export async function updatePlatformSettings(db: Executor, actor: Actor, input: PlatformSettings) {
  const before = await getPlatformSettings(db);
  const next = platformSettingsInput.parse(input);
  await setMeta(db, "platform.settings", JSON.stringify(next));
  const changes = Object.fromEntries(
    (Object.keys(next) as (keyof PlatformSettings)[])
      .filter((k) => before[k] !== next[k])
      .map((k) => [k, { from: before[k], to: next[k] }]),
  );
  if (Object.keys(changes).length) {
    await recordAudit(db, actor, { action: "platform.settings", details: { changes } });
  }
  return getPlatformSettings(db);
}
