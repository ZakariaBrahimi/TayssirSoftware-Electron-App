import { z } from "zod";

/*
 * Quick buttons: pages of big buttons on the till for what is sold most,
 * often without a barcode (bread, photocopies, top-ups...). Saved with the
 * store so every till shows the same buttons.
 */

export const QUICK_COLORS = [
  "teal",
  "sky",
  "violet",
  "rose",
  "amber",
  "lime",
  "orange",
  "slate",
] as const;
export type QuickColor = (typeof QUICK_COLORS)[number];

export const quickKeySchema = z.object({
  productId: z.string().uuid(),
  /** Short text on the button; empty uses the product name. */
  label: z.string().trim().max(24).default(""),
  color: z.enum(QUICK_COLORS).default("teal"),
});

export const quickPageSchema = z.object({
  name: z.string().trim().min(1).max(30),
  keys: z.array(quickKeySchema).max(48),
});

export const quickKeysInput = z.object({ pages: z.array(quickPageSchema).max(10) });
export type QuickKeysInput = z.input<typeof quickKeysInput>;
export type QuickPage = z.output<typeof quickPageSchema>;

export function parseQuickKeys(json: string | null | undefined): QuickPage[] {
  if (!json) return [];
  try {
    const parsed = quickKeysInput.safeParse({ pages: JSON.parse(json) });
    return parsed.success ? parsed.data.pages : [];
  } catch {
    return [];
  }
}
