import { createTranslator } from "next-intl";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import type { StockAlerts } from "../services/forecast";
import { escapeHtml } from "./telegram";

export const DIGEST_LOCALES = ["fr", "ar", "en"] as const;
export type DigestLocale = (typeof DIGEST_LOCALES)[number];
const MESSAGES = { en, fr, ar };
const PER_SECTION = 10;

type Section = { title: string; lines: string[]; more: number };

/**
 * The daily stock summary, as Telegram HTML and as an email. Out of stock
 * first, then products running out soonest, then low ones.
 */
export function buildDigest(opts: {
  storeName: string;
  alerts: StockAlerts;
  locale: DigestLocale;
  /** Link to the reorder page, e.g. https://app.example/fr/reorder. */
  reorderUrl: string | null;
}) {
  const t = createTranslator({
    locale: opts.locale,
    messages: MESSAGES[opts.locale],
    namespace: "digest",
  });
  const { items, summary } = opts.alerts;

  const section = (status: "out" | "soon" | "low"): Section | null => {
    const list = items.filter((i) => i.status === status);
    if (!list.length) return null;
    return {
      title: t(`section_${status}`, { count: list.length }),
      lines: list
        .slice(0, PER_SECTION)
        .map((i) =>
          status === "out"
            ? i.name
            : i.daysLeft !== null
              ? t("lineDays", { name: i.name, stock: i.stock, count: i.daysLeft })
              : t("line", { name: i.name, stock: i.stock }),
        ),
      more: Math.max(0, list.length - PER_SECTION),
    };
  };
  const sections = (["out", "soon", "low"] as const)
    .map(section)
    .filter((s): s is Section => s !== null);

  const subject = t("subject", { store: opts.storeName, count: summary.total });
  const intro = t("intro", { store: opts.storeName });
  const more = (s: Section) => (s.more ? [t("more", { count: s.more })] : []);

  const telegram = [
    `<b>${escapeHtml(intro)}</b>`,
    ...sections.map((s) =>
      [
        "",
        `<b>${escapeHtml(s.title)}</b>`,
        ...s.lines.map((l) => `• ${escapeHtml(l)}`),
        ...more(s).map(escapeHtml),
      ].join("\n"),
    ),
    ...(opts.reorderUrl
      ? ["", `<a href="${escapeHtml(opts.reorderUrl)}">${escapeHtml(t("open"))}</a>`]
      : []),
  ].join("\n");

  const text = [
    intro,
    ...sections.flatMap((s) => ["", s.title, ...s.lines.map((l) => `- ${l}`), ...more(s)]),
    ...(opts.reorderUrl ? ["", `${t("open")}: ${opts.reorderUrl}`] : []),
    "",
    t("footer"),
  ].join("\n");

  const dir = opts.locale === "ar" ? "rtl" : "ltr";
  const html = `<div dir="${dir}" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#0B2A26">
<p style="font-size:17px;font-weight:bold">${escapeHtml(intro)}</p>
${sections
  .map(
    (s) => `<p style="margin:16px 0 4px;font-weight:bold">${escapeHtml(s.title)}</p>
<ul style="margin:0;padding-inline-start:20px">${s.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>
${more(s)
  .map((m) => `<p style="margin:4px 0;color:#5b6b68">${escapeHtml(m)}</p>`)
  .join("")}`,
  )
  .join("\n")}
${
  opts.reorderUrl
    ? `<p style="margin-top:20px"><a href="${escapeHtml(opts.reorderUrl)}" style="background:#0E7C6B;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${escapeHtml(t("open"))}</a></p>`
    : ""
}
<p style="margin-top:24px;font-size:12px;color:#5b6b68">${escapeHtml(t("footer"))}</p>
</div>`;

  return { subject, telegram, text, html };
}
