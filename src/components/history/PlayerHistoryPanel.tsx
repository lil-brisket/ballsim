import Link from "next/link";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { cn, focusRingClass, panelClass } from "@/components/ui/styles";
import { PlayerHistorySearch } from "@/components/history/PlayerHistorySearch";
import type { HistoryHubRoute } from "@/state/history-hub-selectors";
import type {
  PlayerHistoryIndexEntry,
  PlayerHistoryView,
} from "@/state/player-history-selectors";

function Metric(props: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        {props.label}
      </p>
      <p className="mt-1 text-lg text-zinc-50">{props.value}</p>
    </div>
  );
}

function PlayerHistoryDetail(props: {
  saveId: string;
  player: PlayerHistoryView;
}) {
  const { player } = props;
  return (
    <Section
      title={player.displayName}
      action={
        <Link
          href={player.profileHref}
          className={cn(
            "text-sm text-amber-400 hover:underline",
            focusRingClass,
          )}
        >
          View player profile
        </Link>
      }
    >
      {!player.hasHistory ? (
        <EmptyState message="No player history available for this save." />
      ) : (
        <div className="space-y-6">
          <div className={cn(panelClass, "grid gap-4 p-4 sm:grid-cols-4")}>
            <Metric label="Seasons played" value={player.seasonsPlayed} />
            <Metric label="Teams played for" value={player.teamsPlayed} />
            <Metric label="Championships" value={player.championships} />
            <Metric
              label="Status"
              value={player.retired ? "Retired" : "Active"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-zinc-300">
                Team history
              </h3>
              <p className="text-xs text-zinc-500">
                Team of record at each season&apos;s end.
              </p>
              <ul className="divide-y divide-zinc-900 text-sm">
                {player.teamSequence.map((stop) => (
                  <li
                    key={stop.seasonYear}
                    className="flex items-baseline gap-3 py-1.5"
                  >
                    <span className="font-mono text-amber-400">
                      {stop.seasonYear}
                    </span>
                    {stop.teamId ? (
                      <TeamEntityLink
                        saveId={props.saveId}
                        teamId={stop.teamId}
                      >
                        {stop.teamName ?? stop.teamId}
                      </TeamEntityLink>
                    ) : (
                      <span className="text-zinc-500">No team</span>
                    )}
                    {stop.championship ? (
                      <span className="text-xs uppercase tracking-wide text-amber-300">
                        Champion
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-zinc-300">Awards</h3>
              {player.awardTotals.length === 0 ? (
                <p className="text-sm text-zinc-500">No awards yet.</p>
              ) : (
                <ul className="divide-y divide-zinc-900 text-sm">
                  {player.awardTotals.map((award) => (
                    <li
                      key={award.awardId}
                      className="flex justify-between py-1.5"
                    >
                      <span className="text-zinc-200">{award.displayName}</span>
                      <span className="text-zinc-400">×{award.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

export function PlayerHistoryPanel(props: {
  saveId: string;
  route: HistoryHubRoute;
  index: PlayerHistoryIndexEntry[];
  selectedPlayer: PlayerHistoryView | null;
}) {
  if (props.index.length === 0 && !props.selectedPlayer) {
    return <EmptyState message="No player history available for this save." />;
  }
  return (
    <div className="space-y-8">
      {props.selectedPlayer ? (
        <PlayerHistoryDetail
          saveId={props.saveId}
          player={props.selectedPlayer}
        />
      ) : null}
      <Section title="Player search">
        <PlayerHistorySearch
          saveId={props.saveId}
          route={props.route}
          index={props.index}
          selectedPlayerId={props.selectedPlayer?.playerId ?? null}
        />
      </Section>
    </div>
  );
}
