import { DataTable } from "@/components/ui/DataTable";
import { rowLinkClass } from "@/components/league/row-link-class";
import { EmptyState } from "@/components/ui/EmptyState";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import type { LeagueHistoryView } from "@/state/league-history-selectors";

const TD = "px-3 py-2";

export function LeagueHistoryTable(props: {
  saveId: string;
  view: LeagueHistoryView;
}) {
  if (props.view.seasons.length === 0) {
    return <EmptyState message="No completed seasons yet." />;
  }
  const showRunnerUp = props.view.hasRunnerUpData;
  return (
    <DataTable
      caption="League champions by season"
      headers={["Season", "Champion", ...(showRunnerUp ? ["Runner-Up"] : [])]}
    >
      {props.view.seasons.map((row) => (
        <tr key={row.seasonYear}>
          <td className={`${TD} font-mono tabular-nums text-team-ink`}>
            {row.seasonYear}
          </td>
          <td className={TD}>
            <TeamEntityLink
              saveId={props.saveId}
              teamId={row.championTeamId}
              className={rowLinkClass}
            >
              {row.championName}
            </TeamEntityLink>
            <span className="ml-2 text-sm text-faint">
              {row.championRecord}
            </span>
          </td>
          {showRunnerUp ? (
            <td className={TD}>
              {row.runnerUpTeamId && row.runnerUpName ? (
                <TeamEntityLink
                  saveId={props.saveId}
                  teamId={row.runnerUpTeamId}
                  className={rowLinkClass}
                >
                  {row.runnerUpName}
                </TeamEntityLink>
              ) : (
                <span className="text-disabled">—</span>
              )}
            </td>
          ) : null}
        </tr>
      ))}
    </DataTable>
  );
}
