import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Section } from "@/components/ui/Section";
import type { ContractHubOverview } from "@/state/contract-hub-selectors";

export function ContractOverview(props: {
  saveId: string;
  overview: ContractHubOverview;
}) {
  const { overview, saveId } = props;
  return (
    <Section title="Overview">
      <div className="grid gap-4 sm:grid-cols-2">
        <ul className="space-y-1.5 text-sm text-soft">
          <li className="flex justify-between gap-4">
            <span className="text-faint">Players under contract</span>
            <span>{overview.playerCount}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-faint">Total payroll</span>
            <MoneyDisplay amount={overview.totalPayroll} />
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-faint">Expiring within next season</span>
            <span>{overview.expiringCount}</span>
          </li>
          <li className="flex justify-between gap-4">
            <span className="text-faint">Pending options</span>
            <span>{overview.pendingOptionCount}</span>
          </li>
        </ul>
        <div>
          <p className="mb-2 text-sm font-medium text-soft">
            Largest annual salaries
          </p>
          {overview.largestContracts.length === 0 ? (
            <p className="text-sm text-disabled">—</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {overview.largestContracts.map((c) => (
                <li
                  key={c.playerId}
                  className="flex justify-between gap-4 text-soft"
                >
                  <PlayerEntityLink saveId={saveId} playerId={c.playerId}>
                    {c.playerName}
                  </PlayerEntityLink>
                  <MoneyDisplay amount={c.salary} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}
