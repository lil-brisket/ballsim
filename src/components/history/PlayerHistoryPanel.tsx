import Link from "next/link";
import { rowLinkClass } from "@/components/league/row-link-class";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Metric } from "@/components/ui/Metric";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import {
  cn,
  focusRingClass,
  linkClass,
  panelClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { PlayerHistorySearch } from "@/components/history/PlayerHistorySearch";
import type { HistoryHubRoute } from "@/state/history-hub-selectors";
import type {
  PlayerHistoryIndexEntry,
  PlayerHistoryView,
} from "@/state/player-history-selectors";

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
            "text-sm",
            linkClass,
            touchTargetTextClass,
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
              <SectionHeading as="h3" title="Team history" />
              <p className="text-sm text-faint">
                Team of record at each season&apos;s end.
              </p>
              <ul className="divide-y divide-surface-raised text-sm">
                {player.teamSequence.map((stop) => (
                  <li
                    key={stop.seasonYear}
                    className="flex items-baseline gap-3 py-1.5"
                  >
                    <span className="tabular-nums text-team-ink">
                      {stop.seasonYear}
                    </span>
                    {stop.teamId ? (
                      <TeamEntityLink
                        saveId={props.saveId}
                        teamId={stop.teamId}
                        className={rowLinkClass}
                      >
                        {stop.teamName ?? stop.teamId}
                      </TeamEntityLink>
                    ) : (
                      <span className="text-faint">No team</span>
                    )}
                    {stop.championship ? (
                      <span className="text-sm font-medium text-team-ink">
                        Champion
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-2">
              <SectionHeading as="h3" title="Awards" />
              {player.awardTotals.length === 0 ? (
                <p className="text-sm text-faint">No awards yet.</p>
              ) : (
                <ul className="divide-y divide-surface-raised text-sm">
                  {player.awardTotals.map((award) => (
                    <li
                      key={award.awardId}
                      className="flex justify-between py-1.5"
                    >
                      <span className="text-ink">{award.displayName}</span>
                      <span className="text-muted">×{award.count}</span>
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
