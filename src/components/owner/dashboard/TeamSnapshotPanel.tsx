import Link from "next/link";
import type { OwnerDashboardTeam } from "@/state/owner-dashboard";
import type { RecentFormView } from "@/state/recent-form-selectors";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { Section } from "@/components/owner/Section";
import { cn, panelClass } from "@/components/ui/styles";

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return "th";
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

/**
 * Team snapshot strip for Front Office — lists and metrics, not a card grid.
 */
export function TeamSnapshotPanel(props: {
  team: OwnerDashboardTeam;
  saveId: string;
  recentForm: RecentFormView;
}) {
  const { team, saveId, recentForm } = props;
  const standingLine =
    team.conferenceRank !== null && team.conferenceName
      ? `${team.conferenceRank}${ordinal(team.conferenceRank)} in ${team.conferenceName}`
      : `#${team.leagueRank} overall`;

  return (
    <Section
      title="Team Snapshot"
      action={
        <Link
          href={`/dashboard/${saveId}/team`}
          className="text-sm text-amber-400 hover:text-amber-300"
        >
          Team Hub
        </Link>
      }
    >
      <div className={cn(panelClass, "space-y-4 px-4 py-4")}>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="font-mono text-[0.65rem] uppercase tracking-wide text-zinc-500">
              Record
            </dt>
            <dd className="mt-0.5 font-mono text-zinc-100">
              {team.wins}–{team.losses}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[0.65rem] uppercase tracking-wide text-zinc-500">
              Rank
            </dt>
            <dd className="mt-0.5 text-zinc-100">{standingLine}</dd>
          </div>
          <div>
            <dt className="font-mono text-[0.65rem] uppercase tracking-wide text-zinc-500">
              Form (L5)
            </dt>
            <dd className="mt-0.5 font-mono text-zinc-100">
              {recentForm.marks || "—"}
              {recentForm.streak ? (
                <span className="ml-2 text-xs text-zinc-500">
                  {recentForm.streak}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[0.65rem] uppercase tracking-wide text-zinc-500">
              Strength
            </dt>
            <dd className="mt-0.5 font-mono text-zinc-100">{team.strength}</dd>
          </div>
        </dl>

        {team.rosterProblems.length > 0 ? (
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-wide text-rose-400">
              Health
            </p>
            <ul className="mt-1 space-y-1 text-sm text-zinc-300">
              {team.rosterProblems.slice(0, 4).map((problem) => (
                <li key={problem.playerId}>
                  <PlayerEntityLink
                    saveId={saveId}
                    playerId={problem.playerId}
                    className="text-zinc-200 hover:text-amber-400"
                  >
                    {problem.name}
                  </PlayerEntityLink>
                  <span className="text-zinc-500"> — {problem.kind}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-emerald-400/90">Roster health looks stable.</p>
        )}
      </div>
    </Section>
  );
}
