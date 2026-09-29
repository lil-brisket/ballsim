import { ActionCard } from "@/components/ui/ActionCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import type { FranchiseFacilitiesSummary } from "@/state/franchise-hub-selectors";

export function FacilitiesSummarySection(props: {
  summary: FranchiseFacilitiesSummary;
  saveId: string;
}) {
  const { summary, saveId } = props;
  const upgradeLabel =
    summary.upgradingCount > 0
      ? `${summary.upgradingCount} upgrade${summary.upgradingCount === 1 ? "" : "s"} in progress`
      : summary.availableUpgradeCount > 0
        ? `${summary.availableUpgradeCount} upgrade${summary.availableUpgradeCount === 1 ? "" : "s"} available`
        : "No upgrades in progress";

  return (
    <ActionCard
      href={`/dashboard/${saveId}/facilities`}
      title="Renovation"
      description={`Arena capacity ${summary.arenaCapacity.toLocaleString()} · ${upgradeLabel}`}
      footer={
        <span className="text-sm font-medium text-amber-400">
          Manage Facilities
        </span>
      }
    >
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-400">
        {summary.levels.map((row) => (
          <li key={row.category} className="flex justify-between gap-2">
            <span className="capitalize">{row.category}</span>
            <span className="flex items-center gap-1 text-zinc-200">
              L{row.level}
              {row.upgrading ? (
                <StatusBadge label="upgrading" tone="warning" />
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-zinc-500">
        Weekly facility OPEX <MoneyDisplay amount={summary.weeklyOpex} />
      </p>
    </ActionCard>
  );
}
