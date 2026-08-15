/**
 * Pure YYYY-MM-DD helpers for the fictional world calendar.
 * Uses UTC noon to avoid DST edge cases when adding days.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseCalendarDate(isoDate: string): {
  year: number;
  month: number;
  day: number;
} {
  const match = DATE_PATTERN.exec(isoDate);
  if (!match) {
    throw new Error(`Invalid calendar date "${isoDate}"; expected YYYY-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  assertValidYmd(year, month, day, isoDate);
  return { year, month, day };
}

export function formatCalendarDate(
  year: number,
  month: number,
  day: number,
): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addCalendarDays(isoDate: string, days: number): string {
  if (!Number.isInteger(days)) {
    throw new Error("addCalendarDays requires an integer day delta.");
  }
  const { year, month, day } = parseCalendarDate(isoDate);
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  utc.setUTCDate(utc.getUTCDate() + days);
  return formatCalendarDate(
    utc.getUTCFullYear(),
    utc.getUTCMonth() + 1,
    utc.getUTCDate(),
  );
}

/**
 * ISO week id for a YYYY-MM-DD calendar date (e.g. "2026-W32").
 * Weeks start on Monday; week 1 is the week containing the year's first Thursday.
 */
export function getIsoWeekId(isoDate: string): string {
  const { year, month, day } = parseCalendarDate(isoDate);
  const utc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  // Thursday of this week determines the ISO week-year.
  const dayOfWeek = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayOfWeek);
  const isoYear = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1, 12, 0, 0));
  const week =
    Math.floor((utc.getTime() - yearStart.getTime()) / 86_400_000 / 7) + 1;
  return `${String(isoYear).padStart(4, "0")}-W${String(week).padStart(2, "0")}`;
}

/** Calendar month id for a YYYY-MM-DD date (e.g. "2026-08"). */
export function getCalendarMonthId(isoDate: string): string {
  const { year, month } = parseCalendarDate(isoDate);
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function assertValidYmd(
  year: number,
  month: number,
  day: number,
  raw: string,
): void {
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date "${raw}".`);
  }
}
