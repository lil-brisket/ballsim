/**
 * League-wide economic environment (E10). Frozen field set — do not expand
 * into inflation, interest rates, GDP, or regional macro models in Phase E.
 */

export type EconomicCycle = "growth" | "stable" | "recession";

export const ECONOMIC_CYCLES: readonly EconomicCycle[] = [
  "growth",
  "stable",
  "recession",
] as const;

export type LeagueEconomy = {
  /** League popularity 1–99. */
  popularity: number;
  /** Broadcast / media rights value scale 1–99. */
  broadcastValue: number;
  /** Commercial sponsorship climate 1–99. */
  sponsorshipClimate: number;
  cycle: EconomicCycle;
  /** Fraction of designated pool shared equally (0–1). */
  revenueSharingRate: number;
};

export function isEconomicCycle(value: unknown): value is EconomicCycle {
  return (
    typeof value === "string" &&
    (ECONOMIC_CYCLES as readonly string[]).includes(value)
  );
}

export function createDefaultLeagueEconomy(): LeagueEconomy {
  return {
    popularity: 55,
    broadcastValue: 50,
    sponsorshipClimate: 50,
    cycle: "stable",
    revenueSharingRate: 0.2,
  };
}
