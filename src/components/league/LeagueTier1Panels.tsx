import Link from "next/link";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import type { LeagueHubSnapshot } from "@/state/league-hub-selectors";
import type { StandingsRowEnriched } from "@/state/standings-selectors";
import { formatStreak } from "@/state/standings-selectors";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { TickerBar } from "@/components/ui/TickerBar";
import { cn, focusRingClass } from "@/components/ui/styles";
import { rankNumberLabel } from "@/presentation/rank-label";

export function LeagueSnapshotPanel(props: { snapshot: LeagueHubSnapshot }) {
  const s = props.snapshot;
  const metrics = [
    { label: "Leader", value: `${s.leaderAbbreviation} ${s.leaderRecord}` },
    { label: "League rank", value: rankNumberLabel(s.userRank) },
    { label: "Your record", value: s.userRecord },
    { label: "Best", value: s.bestRecord },
    { label: "Worst", value: s.worstRecord },
  ];
  if (s.playoffRaceLabel) {
    metrics.push({ label: "Race", value: s.playoffRaceLabel });
  }
  if (s.mode === "offseason" && s.championAbbreviation) {
    metrics.push({ label: "Champion", value: s.championAbbreviation });
  }

  return (
    <Section title="League Snapshot">
      <ArenaPanel as="div" raised density="compact">
        <TickerBar
          aria-label="League snapshot"
          items={metrics.map((m) => ({
            label: m.label,
            value: m.value,
            tone: m.label === "Your record" ? "team" : "default",
          }))}
        />
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
                <th className="py-1 pr-2 font-medium">#</th>
                <th className="py-1 pr-2 font-medium">Team</th>
                <th className="py-1 pr-2 font-medium">W</th>
                <th className="py-1 pr-2 font-medium">L</th>
                <th className="py-1 pr-2 font-medium">Str</th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => (
                <tr
                  key={row.teamId}
                  className={cn(
                    "border-t border-zinc-800",
                    row.isUserTeam && "bg-team/15",
                    row.conferenceRank === props.cutoffRank &&
                      "border-t border-dashed border-team-ink/50",
                  )}
                >
                  <td className="py-1.5 pr-2 font-mono text-zinc-500">
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
                  <td className="py-1.5 pr-2 font-mono">{row.wins}</td>
                  <td className="py-1.5 pr-2 font-mono">{row.losses}</td>
                  <td className="py-1.5 pr-2 font-mono text-zinc-500">
                    {formatStreak(row.streak)}
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
