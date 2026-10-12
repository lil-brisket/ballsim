import Link from "next/link";
import type { OwnerDashboardTeam } from "@/state/owner-dashboard";
import type { RecentFormView } from "@/state/recent-form-selectors";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { Section } from "@/components/owner/Section";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { TickerBar } from "@/components/ui/TickerBar";
import { cn, touchTargetTextClass } from "@/components/ui/styles";

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
      : team.leagueRank == null
        ? "Unranked"
        : `#${team.leagueRank} overall`;

  return (
    <Section
      title="Team Snapshot"
      action={
        <Link
          href={`/dashboard/${saveId}/team`}
          className={cn(
            touchTargetTextClass,
            "text-sm text-team-ink hover:underline",
          )}
        >
          Team Hub
        </Link>
      }
    >
      <ArenaPanel as="div" raised className="space-y-4">
        <TickerBar
          aria-label="Team snapshot"
          items={[
            {
              label: "Record",
              value: `${team.wins}–${team.losses}`,
              tone: "team",
            },
            { label: "Rank", value: standingLine },
            {
              label: "Form (L5)",
              value: `${recentForm.marks || "—"}${recentForm.streak ? ` ${recentForm.streak}` : ""}`,
            },
            { label: "Strength", value: team.strength },
          ]}
        />

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
                    className="text-zinc-200 hover:text-team-ink"
                  >
                    {problem.name}
                  </PlayerEntityLink>
                  <span className="text-zinc-500"> — {problem.kind}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-emerald-400/90">
            Roster health looks stable.
          </p>
        )}
      </ArenaPanel>
    </Section>
  );
}
