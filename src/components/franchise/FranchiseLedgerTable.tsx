import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { DataTable, numericCellClass } from "@/components/ui/DataTable";
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
    <DataTable
      headers={[
        "Year",
        "Franchise",
        { label: "Revenue", numeric: true },
        { label: "Expenses", numeric: true },
        { label: "Net income", numeric: true },
        { label: "Payroll", numeric: true },
        { label: "Funds", numeric: true },
        { label: "Value", numeric: true },
      ]}
    >
      {[...props.seasons].reverse().map((season) => (
        <tr key={season.seasonId} className="text-ink">
          <td className="px-3 py-2">{season.seasonYear}</td>
          <td className="px-3 py-2">
            {identity(season)}
            {season.relocated ? (
              <span className="ml-2 text-faint">relocated</span>
            ) : null}
          </td>
          <td className={`px-3 py-2 ${numericCellClass}`}>
            <MoneyDisplay amount={season.revenue} />
          </td>
          <td className={`px-3 py-2 ${numericCellClass}`}>
            <MoneyDisplay amount={season.expenses} />
          </td>
          <td className={`px-3 py-2 ${numericCellClass}`}>
            <MoneyDisplay amount={season.netIncome} />
          </td>
          <td className={`px-3 py-2 ${numericCellClass}`}>
            <MoneyDisplay amount={season.payroll} />
          </td>
          <td className={`px-3 py-2 ${numericCellClass}`}>
            <MoneyDisplay amount={season.businessFunds} />
          </td>
          <td className={`px-3 py-2 ${numericCellClass}`}>
            <MoneyDisplay amount={season.franchiseValue} />
          </td>
        </tr>
      ))}
    </DataTable>
  );
}
