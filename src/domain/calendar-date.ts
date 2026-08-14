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
