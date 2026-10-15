import { endOfDay, format, startOfDay, startOfMonth, subDays } from "date-fns";

/** yyyy-MM-dd for <input type="date"> */
export const toDateInput = (d: Date) => format(d, "yyyy-MM-dd");

/** Local start of the day as an ISO string with offset-free UTC time. */
export const dayStartIso = (value: string) =>
  startOfDay(new Date(`${value}T00:00:00`)).toISOString();
export const dayEndIso = (value: string) => endOfDay(new Date(`${value}T00:00:00`)).toISOString();

export type RangePreset = "today" | "last7" | "last30" | "thisMonth";

export function presetRange(preset: RangePreset, now = new Date()) {
  switch (preset) {
    case "today":
      return { from: toDateInput(now), to: toDateInput(now) };
    case "last7":
      return { from: toDateInput(subDays(now, 6)), to: toDateInput(now) };
    case "last30":
      return { from: toDateInput(subDays(now, 29)), to: toDateInput(now) };
    case "thisMonth":
      return { from: toDateInput(startOfMonth(now)), to: toDateInput(now) };
  }
}

/** Minutes east of UTC (inverse sign of getTimezoneOffset). */
export const tzOffsetMinutes = (d = new Date()) => -d.getTimezoneOffset();
