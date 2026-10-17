/**
 * Broadcast-style game dates: "Oct 8", "Sat, Oct 10", "Oct 8, 2026".
 * Takes the ISO calendar dates the game stores ("2026-10-08", or a full ISO
 * timestamp) and formats them in UTC so a day never shifts with the viewer's
 * timezone. Never show raw ISO strings in the UI.
 */
export type GameDateOptions = {
  /** Prefix the weekday: "Sat, Oct 10". */
  weekday?: boolean;
  /** Append the year: "Oct 8, 2026". */
  year?: boolean;
};

function parseIsoDay(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatGameDate(
  iso: string,
  options: GameDateOptions = {},
): string {
  const date = parseIsoDay(iso);
  if (!date) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(options.weekday ? { weekday: "short" as const } : {}),
    ...(options.year ? { year: "numeric" as const } : {}),
  }).format(date);
}

/** "Today", "Tomorrow", "In 3 days", "Yesterday", "3 days ago". */
export function formatRelativeGameDay(iso: string, todayIso: string): string {
  const a = parseIsoDay(iso);
  const b = parseIsoDay(todayIso);
  if (!a || !b) return iso;
  const days = Math.round((a.getTime() - b.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}
