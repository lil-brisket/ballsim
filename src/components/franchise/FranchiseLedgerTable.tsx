import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import type { FranchiseSeasonRecord } from "@/domain/entities/franchise-history";

export type FranchiseIdentityChange = {
  seasonYear: number;
  /** A city move (relocation) rather than a rename in the same city. */
  kind: "relocation" | "rebrand";
  from: string;
  to: string;
  /** Value and fan sentiment at the end of the season before the change. */
  valueBefore: number;
  valueAfter: number;
  sentimentBefore: number;
  sentimentAfter: number;
};

function identity(season: FranchiseSeasonRecord): string {
  return `${season.city} ${season.name}`;
}

/**
 * Seasons (chronological input) where the franchise ended under a new city
 * or name, with value and fan sentiment either side of the change.
 */
export function toFranchiseIdentityChanges(
  seasons: readonly FranchiseSeasonRecord[],
): FranchiseIdentityChange[] {
  const changes: FranchiseIdentityChange[] = [];
  for (let i = 1; i < seasons.length; i += 1) {
    const before = seasons[i - 1];
    const after = seasons[i];
    const from = identity(before);
    const to = identity(after);
    if (from === to) {
      continue;
    }
    changes.push({
      seasonYear: after.seasonYear,
      kind:
        after.relocated || before.city !== after.city
          ? "relocation"
          : "rebrand",
      from,
      to,
      valueBefore: before.franchiseValue,
      valueAfter: after.franchiseValue,
      sentimentBefore: before.fanSentiment,
      sentimentAfter: after.fanSentiment,
    });
  }
  return changes;
}

/**
 * Season-by-season business ledger for the owned franchise, newest first.
 * Input seasons are chronological, as stored in franchise history.
 */
export function FranchiseLedgerTable(props: {
  seasons: readonly FranchiseSeasonRecord[];
}) {
  if (props.seasons.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-800 text-zinc-400">
          <tr>
            <th className="px-3 py-2">Year</th>
            <th className="px-3 py-2">Franchise</th>
            <th className="px-3 py-2">Revenue</th>
            <th className="px-3 py-2">Expenses</th>
            <th className="px-3 py-2">Net income</th>
            <th className="px-3 py-2">Payroll</th>
            <th className="px-3 py-2">Funds</th>
            <th className="px-3 py-2">Value</th>
          </tr>
        </thead>
        <tbody>
          {[...props.seasons].reverse().map((season) => (
            <tr
              key={season.seasonId}
              className="border-b border-zinc-900 text-zinc-200"
            >
              <td className="px-3 py-2">{season.seasonYear}</td>
              <td className="px-3 py-2">
                {identity(season)}
                {season.relocated ? (
                  <span className="ml-2 text-zinc-500">relocated</span>
                ) : null}
              </td>
              <td className="px-3 py-2">
                <MoneyDisplay amount={season.revenue} />
              </td>
              <td className="px-3 py-2">
                <MoneyDisplay amount={season.expenses} />
              </td>
              <td className="px-3 py-2">
                <MoneyDisplay amount={season.netIncome} />
              </td>
              <td className="px-3 py-2">
                <MoneyDisplay amount={season.payroll} />
              </td>
              <td className="px-3 py-2">
                <MoneyDisplay amount={season.businessFunds} />
              </td>
              <td className="px-3 py-2">
                <MoneyDisplay amount={season.franchiseValue} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
