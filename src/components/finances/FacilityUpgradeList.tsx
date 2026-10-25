import { upgradeFacilityAction } from "@/application/actions";
import { FACILITY_LEVEL_MAX } from "@/domain/entities/franchise-ops";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { FacilityRowView } from "@/state/franchise-selectors";
import { arenaCapacityForLevel } from "@/systems/facilities-config";

/** Arena first: it is the upgrade owners look for (Issue #189). */
function sortArenaFirst(rows: FacilityRowView[]): FacilityRowView[] {
  return [
    ...rows.filter((row) => row.category === "arena"),
    ...rows.filter((row) => row.category !== "arena"),
  ];
}

function arenaDetail(level: number): string {
  const current = arenaCapacityForLevel(level).toLocaleString();
  if (level >= FACILITY_LEVEL_MAX) {
    return `Capacity ${current} seats`;
  }
  const next = arenaCapacityForLevel(level + 1).toLocaleString();
  return `Capacity ${current} → ${next} seats next level`;
}

export function FacilityUpgradeList(props: {
  saveId: string;
  rows: FacilityRowView[];
  returnPath: string;
}) {
  if (props.rows.length === 0) {
    return <EmptyState message="No facility data." />;
  }
  return (
    <ul className="space-y-2">
      {sortArenaFirst(props.rows).map((row) => (
        <li
          key={row.category}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-800 px-4 py-3"
        >
          <div>
            <p className="font-medium capitalize text-zinc-100">
              {row.category}
            </p>
            <p className="text-sm text-zinc-400">
              Level {row.level}
              {row.upgradeWeeksRemaining > 0
                ? ` · upgrading (${row.upgradeWeeksRemaining} weeks left)`
                : null}
            </p>
            {row.category === "arena" ? (
              <p className="text-sm text-zinc-500">{arenaDetail(row.level)}</p>
            ) : null}
          </div>
          {row.upgradeCost != null ? (
            <form action={upgradeFacilityAction}>
              <input type="hidden" name="saveId" value={props.saveId} />
              <input type="hidden" name="category" value={row.category} />
              <input type="hidden" name="returnPath" value={props.returnPath} />
              <button
                type="submit"
                className={buttonClass({ variant: "primary" })}
              >
                Upgrade (<MoneyDisplay amount={row.upgradeCost} />)
              </button>
            </form>
          ) : (
            <span className="text-sm text-zinc-500">
              {row.level >= FACILITY_LEVEL_MAX ? "Max level" : "In progress"}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
