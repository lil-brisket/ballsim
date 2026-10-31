import Link from "next/link";
import { RosterSheet } from "@/components/roster/sheet/RosterSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn, focusRingClass } from "@/components/ui/styles";
import type { TeamRosterView } from "@/state/team-roster-view";

/**
 * Another team's roster as a read-only sheet, with a compact picker of every
 * team in the league.
 */
export function TeamRosterPage(props: {
  saveId: string;
  view: TeamRosterView;
}) {
  const { view } = props;
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <SectionHeading as="h1" size="md" title={`${view.city} ${view.name}`} />
        <p className="text-sm text-muted">
          <span className="tabular-nums">
            {view.record.wins}-{view.record.losses}
          </span>{" "}
          · Scouting view
        </p>
      </header>

      <nav aria-label="Team rosters">
        <ul className="flex flex-wrap gap-1.5">
          {view.teams.map((team) => {
            const current = team.teamId === view.teamId;
            return (
              <li key={team.teamId}>
                <Link
                  href={team.href}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "inline-block rounded-md border px-2 py-1 font-mono text-xs",
                    current
                      ? "border-team-ink bg-team/15 text-team-ink"
                      : "border-line-strong text-soft hover:border-faint",
                    focusRingClass,
                  )}
                >
                  {team.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {view.players.length === 0 ? (
        <EmptyState message="No players on this roster." />
      ) : (
        <RosterSheet
          variant="league"
          label={`${view.name} roster sheet`}
          saveId={props.saveId}
          players={view.players}
          returnPath={`/dashboard/${props.saveId}/league/teams/${view.teamId}`}
        />
      )}
    </div>
  );
}
