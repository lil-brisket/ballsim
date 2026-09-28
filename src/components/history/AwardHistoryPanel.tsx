import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import { AwardHistoryFilters } from "@/components/history/AwardHistoryFilters";
import {
  AwardWinnerName,
  AwardWinnerTeam,
} from "@/components/history/AwardWinnerLinks";
import type { AwardHistoryView } from "@/state/awards-hub-selectors";
import type { HistoryHubRoute } from "@/state/history-hub-selectors";

const TH = "px-3 py-2 font-medium";
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
                <tr>
                  <th className={TH}>Season</th>
                  {pivotDefinitions.map((def) => (
                    <th key={def.id} className={TH} title={def.displayName}>
                      {def.shortLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {view.seasons.map((season) => (
                  <tr key={season.seasonYear} className="border-b border-zinc-900/80">
                    <td className={`${TD} font-mono text-amber-400`}>
                      {season.seasonYear}
                    </td>
                    {pivotDefinitions.map((def) => {
                      const row = season.yearlyByAwardId[def.id];
                      return (
                        <td key={def.id} className={TD}>
                          {row ? (
                            <div className="space-y-0.5">
                              <AwardWinnerName saveId={props.saveId} row={row} />
                              <div className="text-xs">
                                <AwardWinnerTeam saveId={props.saveId} row={row} />
                              </div>
                            </div>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : (
        view.seasons.map((season) => (
          <Section key={season.seasonYear} title={String(season.seasonYear)}>
            {season.winners.length === 0 ? (
              <EmptyState message="No award history available yet." />
            ) : (
              <ul className="divide-y divide-zinc-900 text-sm">
                {season.winners.map((row) => (
                  <li
                    key={row.result.id}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2"
                  >
                    <span className="text-zinc-400">
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
