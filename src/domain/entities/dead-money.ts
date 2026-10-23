import type { PlayerId, TeamId } from "@/domain/ids";

/**
 * Why a team still owes salary to a player it no longer rosters.
 * - `waived`: the remaining salary stays on the original schedule.
 * - `bought_out`: a negotiated lump paid at release; the cap hit is spread
 *   over the seasons the contract had left.
 * - `buyout_paid`: salary of the release season already paid before a
 *   buyout. Cap only, never paid again.
 */
export type DeadMoneyReason = "waived" | "bought_out" | "buyout_paid";

export const DEAD_MONEY_REASONS: readonly DeadMoneyReason[] = [
  "waived",
  "bought_out",
  "buyout_paid",
];

/**
 * One season of a released contract that still counts against a team.
 * Counts toward payroll and cap in `seasonYear`. Waived money is paid from
 * cash with weekly payroll; prepaid entries (buyouts) are cap only.
 */
export type DeadMoneyEntry = {
  playerId: PlayerId;
  teamId: TeamId;
  seasonYear: number;
  amount: number;
  reason: DeadMoneyReason;
  /** True when the cash already left (buyout lump or salary paid before it). */
  prepaid: boolean;
  /** Calendar date of the release. */
  createdOn: string;
};

/** Dead money by team id. Entries are kept after their season for history. */
export type DeadMoneyState = Record<string, DeadMoneyEntry[]>;

export function isDeadMoneyReason(value: unknown): value is DeadMoneyReason {
  return (
    typeof value === "string" &&
    (DEAD_MONEY_REASONS as readonly string[]).includes(value)
  );
}

/** Total dead money a team carries in a season (cap view). */
export function deadMoneyForSeason(
  entries: readonly DeadMoneyEntry[] | undefined,
  seasonYear: number,
): number {
  if (!entries) return 0;
  let total = 0;
  for (const entry of entries) {
    if (entry.seasonYear === seasonYear) total += entry.amount;
  }
  return total;
}

/** Dead money already paid in cash for a season (excluded from weekly pay). */
export function prepaidDeadMoneyForSeason(
  entries: readonly DeadMoneyEntry[] | undefined,
  seasonYear: number,
): number {
  if (!entries) return 0;
  let total = 0;
  for (const entry of entries) {
    if (entry.seasonYear === seasonYear && entry.prepaid) total += entry.amount;
  }
  return total;
}
