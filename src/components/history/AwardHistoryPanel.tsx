import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { AwardHistoryFilters } from "@/components/history/AwardHistoryFilters";
import {
  AwardWinnerName,
  AwardWinnerTeam,
} from "@/components/history/AwardWinnerLinks";
import type { AwardHistoryView } from "@/state/awards-hub-selectors";
import type { HistoryHubRoute } from "@/state/history-hub-selectors";

const TD = "px-3 py-2 align-top";

/**
 * Default: compact pivot (one row per season, one column per full-season
 * major award). An award filter switches to a grouped list so monthly and
 * midseason awards never become extra columns.
 */
export function AwardHistoryPanel(props: {
  saveId: string;
  route: HistoryHubRoute;
  view: AwardHistoryView;
}) {
  const { view } = props;
  if (!view.hasHistory) {
    return <EmptyState message="No award history available yet." />;
  }

  const definitionsById = new Map(view.definitions.map((d) => [d.id, d]));
  const pivotDefinitions = view.pivotAwardIds
    .map((id) => definitionsById.get(id))
    .filter((def) => def !== undefined);

  return (
    <div className="space-y-4">
      <AwardHistoryFilters
        saveId={props.saveId}
        route={props.route}
        currentSeasonYear={view.currentSeasonYear}
        availableSeasons={view.availableSeasons}
        selectedSeason={String(view.selectedSeason ?? "all")}
        awardFilter={view.awardFilter ?? ""}
        awardOptions={view.definitions.map((def) => ({
          id: def.id,
          label: def.displayName,
        }))}
      />

      {view.awardFilter === null ? (
        <Section title="Season awards">
          <DataTable
            caption="Season awards by year"
            headers={[
              "Season",
              ...pivotDefinitions.map((def) => def.shortLabel),
            ]}
          >
            {view.seasons.map((season) => (
              <tr key={season.seasonYear}>
                <td className={`${TD} font-mono tabular-nums text-team-ink`}>
                  {season.seasonYear}
                </td>
                {pivotDefinitions.map((def) => {
                  const row = season.yearlyByAwardId[def.id];
                  return (
                    <td key={def.id} className={TD}>
                      {row ? (
                        <div className="space-y-0.5">
                          <AwardWinnerName saveId={props.saveId} row={row} />
                          <div className="text-sm">
                            <AwardWinnerTeam saveId={props.saveId} row={row} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-disabled">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </DataTable>
        </Section>
      ) : (
        view.seasons.map((season) => (
          <Section key={season.seasonYear} title={String(season.seasonYear)}>
            {season.winners.length === 0 ? (
              <EmptyState message="No award history available yet." />
            ) : (
              <ul className="divide-y divide-surface-raised text-sm">
                {season.winners.map((row) => (
                  <li
                    key={row.result.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2"
                  >
                    <span className="text-muted">
                      {row.displayName}
                      {row.result.period && row.result.period !== "midseason"
                        ? ` · ${row.result.period}`
                        : ""}
                    </span>
                    <AwardWinnerName saveId={props.saveId} row={row} />
                    <AwardWinnerTeam saveId={props.saveId} row={row} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ))
      )}
    </div>
  );
}
