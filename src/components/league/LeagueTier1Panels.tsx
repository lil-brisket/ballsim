import Link from "next/link";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { EmptyState } from "@/components/owner/EmptyState";
import { Section } from "@/components/owner/Section";
import type { LeagueHubSnapshot } from "@/state/league-hub-selectors";
import type { StandingsRowEnriched } from "@/state/standings-selectors";
import { formatStreak } from "@/state/standings-selectors";
import { cn, focusRingClass } from "@/components/ui/styles";

export function LeagueSnapshotPanel(props: {
  snapshot: LeagueHubSnapshot;
}) {
  const s = props.snapshot;
  const metrics = [
    { label: "Leader", value: `${s.leaderAbbreviation} ${s.leaderRecord}` },
    { label: "Your rank", value: s.userRank > 0 ? `#${s.userRank}` : "—" },
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
      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2"
          >
            <dt className="font-mono text-[0.65rem] uppercase tracking-wide text-zinc-500">
              {m.label}
            </dt>
            <dd className="mt-1 text-sm font-medium text-zinc-100">{m.value}</dd>
          </div>
        ))}
      </dl>
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
            "text-sm text-amber-400 hover:text-amber-300",
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
                    row.isUserTeam && "bg-amber-950/25",
                    row.conferenceRank === props.cutoffRank &&
                      "border-t border-dashed border-amber-800/50",
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
                          ? "font-medium text-amber-300"
                          : "text-zinc-100",
                        "hover:text-amber-400",
                        focusRingClass,
                      )}
                    >
                      {row.abbreviation}
                    </TeamEntityLink>
                    {row.isUserTeam && props.includesUserOutsideTop ? (
                      <span className="ml-2 text-[0.65rem] text-amber-500">
                        you
                      </span>
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
