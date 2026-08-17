import Link from "next/link";
import type { OwnerDashboardTeam } from "@/state/owner-dashboard";
import { EmptyState } from "@/components/owner/EmptyState";
import { MoneyDisplay } from "@/components/owner/MoneyDisplay";
import { Section } from "@/components/owner/Section";

export function TeamDecisionPanel(props: {
  team: OwnerDashboardTeam;
  saveId: string;
}) {
  const { team, saveId } = props;
  const standingLine =
    team.conferenceRank !== null && team.conferenceName
      ? `${team.wins}–${team.losses} · ${team.conferenceRank}${ordinal(team.conferenceRank)} in ${team.conferenceName}`
      : `${team.wins}–${team.losses} · #${team.leagueRank} overall`;

  const payrollContext =
    team.payrollVsLeaguePct !== null
      ? `${team.payrollVsLeaguePct >= 0 ? "+" : ""}${Math.round(team.payrollVsLeaguePct)}% vs league`
      : null;

  const nextGame = team.upcomingGames[0];

  return (
    <Section
      title="Team"
      action={
        <Link
          href={`/dashboard/${saveId}/team`}
          className="text-sm text-amber-400 hover:text-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
        >
          View Team
        </Link>
      }
    >
      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-zinc-500">
            Performance
          </p>
          <p className="mt-1 text-lg text-zinc-50">{standingLine}</p>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Strength</dt>
            <dd className="font-mono text-zinc-200">{team.strength}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Payroll</dt>
            <dd className="text-zinc-200">
              <MoneyDisplay amount={team.payroll} />
              {payrollContext ? (
                <span className="ml-2 text-xs text-zinc-500">
                  {payrollContext}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>

        {team.rosterProblems.length > 0 ? (
          <div className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-2 text-sm text-rose-200">
            <p className="font-medium">Roster concerns</p>
            <ul className="mt-1 space-y-0.5 text-xs text-rose-300/90">
              {team.rosterProblems.slice(0, 3).map((problem) => (
                <li key={problem.playerId}>
                  {problem.name} — {problem.kind}
                </li>
              ))}
            </ul>
            <Link
              href={`/dashboard/${saveId}/roster`}
              className="mt-2 inline-block text-xs text-amber-400 hover:text-amber-300"
            >
              Review Roster
            </Link>
          </div>
        ) : null}

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Upcoming
          </p>
          {team.upcomingGames.length === 0 ? (
            <EmptyState message="No upcoming scheduled games." />
          ) : (
            <ul className="mt-2 space-y-1.5">
              {team.upcomingGames.map((game) => (
                <li
                  key={game.gameId}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-zinc-500">{game.date}</span>
                  <span className="text-zinc-200">
                    {game.home ? "vs" : "@"} {game.opponentAbbreviation}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {nextGame ? (
            <p className="mt-2 text-xs text-zinc-500">
              Next: {nextGame.home ? "vs" : "@"} {nextGame.opponentAbbreviation}{" "}
              on {nextGame.date}
            </p>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return "th";
  }
  switch (n % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}
