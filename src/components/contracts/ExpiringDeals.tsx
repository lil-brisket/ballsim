import { ExtendContractDialog } from "@/components/contracts/ExtendContractDialog";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Section } from "@/components/ui/Section";
import type { ContractHubRow } from "@/state/contract-hub-selectors";

function seasonsLeftLabel(seasonsLeft: number): string {
  if (seasonsLeft <= 0) return "Ends this offseason";
  if (seasonsLeft === 1) return "Final season";
  return `${seasonsLeft} seasons left`;
}

/**
 * Deals the owner can extend now. Renders nothing when there are none.
 */
export function ExpiringDeals(props: {
  saveId: string;
  rows: ContractHubRow[];
  returnPath: string;
}) {
  const { saveId, returnPath } = props;
  // Deals in their final season (or ending now). Two-season deals can be
  // extended from the full table below.
  const rows = props.rows.filter(
    (row) => row.extension !== null && row.extension.seasonsLeft <= 1,
  );
  if (rows.length === 0) return null;

  return (
    <Section title="Expiring deals">
      <ul className="divide-y divide-line rounded-md border border-line">
        {rows.map((row) => {
          const extension = row.extension!;
          return (
            <li
              key={row.contractId}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2"
            >
              <div className="min-w-0">
                <PlayerEntityLink saveId={saveId} playerId={row.playerId}>
                  {row.playerName}
                </PlayerEntityLink>
                <p className="text-sm text-muted">
                  <MoneyDisplay amount={extension.currentSalary} /> a season ·{" "}
                  {seasonsLeftLabel(extension.seasonsLeft)}
                </p>
              </div>
              <ExtendContractDialog
                saveId={saveId}
                playerId={row.playerId}
                playerName={row.playerName}
                returnPath={returnPath}
                extension={extension}
              />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
