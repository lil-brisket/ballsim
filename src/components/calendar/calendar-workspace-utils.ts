import { parseCalendarDate } from "@/domain/calendar-date";

export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function buildCalendarHref(input: {
  saveId: string;
  year: number;
  month: number;
  date?: string;
  resumeTo?: string | null;
}): string {
  const params = new URLSearchParams();
  params.set("year", String(input.year));
  params.set("month", String(input.month));
  if (input.date) {
    params.set("date", input.date);
  }
  if (input.resumeTo) {
    params.set("resumeTo", input.resumeTo);
  }
  return `/dashboard/${input.saveId}/calendar?${params.toString()}`;
}

export function dateInMonth(
  date: string,
  year: number,
  month: number,
): boolean {
  try {
    const parsed = parseCalendarDate(date);
    return parsed.year === year && parsed.month === month;
  } catch {
    return false;
  }
}
