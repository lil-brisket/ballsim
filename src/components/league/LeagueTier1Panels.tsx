import Link from "next/link";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import type { LeagueHubSnapshot } from "@/state/league-hub-selectors";
import type { StandingsRowEnriched } from "@/state/standings-selectors";
import { formatStreak } from "@/state/standings-selectors";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { StreakChip } from "@/components/league/StreakChip";
import { TickerBar, type TickerItem } from "@/components/ui/TickerBar";
import { cn, focusRingClass } from "@/components/ui/styles";

/**
 * One league strip (leader, playoff cutoff, worst, race). Your record and
 * rank are in the game header; your seed and games back are in the hero.
 */
export function LeagueSnapshotPanel(props: {
  snapshot: LeagueHubSnapshot;
  cutoffTeam?: { abbreviation: string; wins: number; losses: number } | null;
}) {
  const s = props.snapshot;
  const metrics: TickerItem[] = [
    { label: "Leader", value: `${s.leaderAbbreviation} ${s.leaderRecord}` },
  ];
  if (props.cutoffTeam) {
    metrics.push({
      label: "Playoff cutoff",
      value: `${props.cutoffTeam.abbreviation} ${props.cutoffTeam.wins}–${props.cutoffTeam.losses}`,
    });
  }
  metrics.push({ label: "Worst", value: s.worstRecord });
  if (s.playoffRaceLabel) {
    metrics.push({ label: "Race", value: s.playoffRaceLabel });
  }
  if (s.mode === "offseason" && s.championAbbreviation) {
    metrics.push({ label: "Champion", value: s.championAbbreviation });
  }

  return (
    <Section title="League Snapshot">
      <ArenaPanel as="div" raised density="compact">
        <TickerBar aria-label="League snapshot" items={metrics} />
      </ArenaPanel>
    </Section>
  );
}

export function LeagueStandingsSnapshot(props: {
  saveId: string;
  rows: StandingsRowEnriched[];
  cutoffRank: number;
  includesUserOutsideTop: boolean;
}) {
  const standingsHref = `/dashboard/${props.saveId}/standings`;

  return (
    <Section
      title="Standings"
      action={
        <Link
          href={standingsHref}
          className={cn(
            "text-sm text-team-ink underline-offset-4 hover:underline",
            focusRingClass,
          )}
        >
          View Standings
        </Link>
      }
    >
      {props.rows.length === 0 ? (
        <EmptyState message="No standings available yet." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-1 pr-2 text-right font-medium">#</th>
                <th className="py-1 pr-2 font-medium">Team</th>
                <th className="py-1 pr-2 text-right font-medium">W</th>
                <th className="py-1 pr-2 text-right font-medium">L</th>
                <th className="py-1 pr-2 text-right font-medium">Streak</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => (
                <tr
                  key={row.teamId}
                  className={cn(
                    "border-t border-zinc-800",
                    row.isUserTeam &&
                      "bg-team/15 shadow-[inset_3px_0_0_0_rgb(var(--team-ink-rgb))]",
                    row.conferenceRank === props.cutoffRank &&
                      "border-t border-dashed border-team-ink/50",
                  )}
                >
                  <td className="py-1.5 pr-2 text-right tabular-nums text-zinc-500">
                    {row.leagueRank}
                  </td>
                  <td className="py-1.5 pr-2">
                    <TeamEntityLink
                      saveId={props.saveId}
                      teamId={row.teamId}
                      className={cn(
                        row.isUserTeam
                          ? "font-medium text-team-ink"
                          : "text-zinc-100",
                        "hover:text-team-ink",
                        focusRingClass,
                      )}
                    >
                      {row.abbreviation}
                    </TeamEntityLink>
                    {row.isUserTeam && props.includesUserOutsideTop ? (
                      <span className="ml-2 text-xs text-team-ink">you</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    {row.wins}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">
                    {row.losses}
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    <StreakChip label={formatStreak(row.streak)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
