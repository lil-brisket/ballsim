import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { rowLinkPlainClass } from "@/components/league/row-link-class";
import { TeamIdentityInline } from "@/components/team/TeamIdentityInline";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn, panelClass } from "@/components/ui/styles";
import type { PlayoffRaceView } from "@/state/standings-selectors";

function WinPctBar(props: { winPercentage: number; label: string }) {
  const pct = Math.min(100, Math.max(0, props.winPercentage * 100));
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-surface-high"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={props.label}
    >
      <div
        className="h-full rounded-full bg-team-ink"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function RaceRow(props: {
  saveId: string;
  team: PlayoffRaceView["above"][number];
}) {
  const team = props.team;
  return (
    <li
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-1.5",
        team.isUserTeam && "text-team-ink",
      )}
      data-testid={`playoff-race-team-${team.teamId}`}
    >
      <div className="min-w-0">
        <div className="mb-1 flex items-center justify-between gap-2">
          <TeamEntityLink
            saveId={props.saveId}
            teamId={team.teamId}
            className={cn(
              rowLinkPlainClass,
              "min-w-0 truncate hover:text-team-ink",
            )}
          >
            <TeamIdentityInline
              city={team.city}
              name={team.name}
              abbreviation={team.abbreviation}
              branding={team.branding}
              size="sm"
            />
          </TeamEntityLink>
        </div>
        <WinPctBar
          winPercentage={team.winPercentage}
          label={`${team.abbreviation} win percentage`}
        />
      </div>
      <span className="shrink-0 font-mono text-sm text-muted">
        {team.wins}–{team.losses}
      </span>
    </li>
  );
}

export function PlayoffRaceWidget(props: {
  saveId: string;
  view: PlayoffRaceView;
}) {
  if (!props.view.applicable) {
    return null;
  }

  return (
    <section
      className={cn(panelClass, "px-3 py-3")}
      aria-label="Playoff race"
      data-testid="playoff-race"
    >
      <SectionHeading
        className="mb-2"
        title={
          props.view.conferenceName
            ? `Playoff Race · ${props.view.conferenceName}`
            : "Playoff Race"
        }
      />
      <ol className="m-0 list-none p-0">
        {props.view.above.map((team) => (
          <RaceRow key={team.teamId} saveId={props.saveId} team={team} />
        ))}
      </ol>
      <div
        className="my-2 flex items-center gap-2"
        data-testid="playoff-race-divider"
        role="separator"
        aria-label="Playoff cutoff"
      >
        <span className="h-px flex-1 bg-team-ink/60" />
        <span className="text-sm font-medium text-team-ink">Playoff</span>
        <span className="h-px flex-1 bg-team-ink/60" />
      </div>
      <ol className="m-0 list-none p-0">
        {props.view.below.map((team) => (
          <RaceRow key={team.teamId} saveId={props.saveId} team={team} />
        ))}
      </ol>
    </section>
  );
}
