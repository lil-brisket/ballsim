import Link from "next/link";
import type { OwnerDashboardTeam } from "@/state/owner-dashboard";
import { PlayerEntityLink } from "@/components/entity/PlayerEntityLink";
import { Section } from "@/components/ui/Section";
import { ArenaPanel } from "@/components/ui/ArenaPanel";
import { TickerBar, type TickerItem } from "@/components/ui/TickerBar";
import { cn, touchTargetTextClass } from "@/components/ui/styles";
import { groupRankLabel } from "@/presentation/rank-label";

/**
 * Team snapshot strip for Front Office — lists and metrics, not a card grid.
 */
export function TeamSnapshotPanel(props: {
  team: OwnerDashboardTeam;
  saveId: string;
}) {
  const { team, saveId } = props;
  const items: TickerItem[] = [];
  // Record, league rank and form already show in the game header and hero;
  // conference position and strength add context.
  if (team.conferenceRank !== null && team.conferenceName) {
    items.push({
      label: "Conference",
      value: groupRankLabel(team.conferenceName, team.conferenceRank),
    });
  }
  items.push({ label: "Strength", value: team.strength });

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
        <TickerBar aria-label="Team snapshot" items={items} />

        {team.rosterProblems.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-rose-400">Health</p>
            <ul className="mt-1 space-y-1 text-sm text-soft">
              {team.rosterProblems.slice(0, 4).map((problem) => (
                <li key={problem.playerId}>
                  <PlayerEntityLink
                    saveId={saveId}
                    playerId={problem.playerId}
                    className="text-ink hover:text-team-ink"
                  >
                    {problem.name}
                  </PlayerEntityLink>
                  <span className="text-faint"> — {problem.kind}</span>
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
