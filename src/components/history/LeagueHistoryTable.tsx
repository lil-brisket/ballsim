import { EmptyState } from "@/components/owner/EmptyState";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import type { LeagueHistoryView } from "@/state/league-history-selectors";

const TH = "px-3 py-2 font-medium";
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="border-b border-zinc-800 text-xs uppercase text-zinc-500">
          <tr>
            <th className={TH}>Season</th>
            <th className={TH}>Champion</th>
            {showRunnerUp ? <th className={TH}>Runner-Up</th> : null}
          </tr>
        </thead>
        <tbody>
          {props.view.seasons.map((row) => (
            <tr key={row.seasonYear} className="border-b border-zinc-900/80">
              <td className={`${TD} font-mono text-amber-400`}>
                {row.seasonYear}
              </td>
              <td className={TD}>
                <TeamEntityLink
                  saveId={props.saveId}
                  teamId={row.championTeamId}
                >
                  {row.championName}
                </TeamEntityLink>
                <span className="ml-2 text-xs text-zinc-500">
                  {row.championRecord}
                </span>
              </td>
              {showRunnerUp ? (
                <td className={TD}>
                  {row.runnerUpTeamId && row.runnerUpName ? (
                    <TeamEntityLink
                      saveId={props.saveId}
                      teamId={row.runnerUpTeamId}
                    >
                      {row.runnerUpName}
                    </TeamEntityLink>
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
