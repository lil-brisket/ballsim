"use client";

import {
  MomentOverlay,
  type MomentStep,
} from "@/components/moments/MomentOverlay";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { cn } from "@/components/ui/styles";
import type {
  AwardsNightAward,
  AwardsNightFinalist,
  AwardsNightView,
} from "@/state/awards-night-selectors";

function splitName(name: string): [string, string] {
  const index = name.indexOf(" ");
  return index < 0 ? [name, ""] : [name.slice(0, index), name.slice(index + 1)];
}

/** Text marker, so the user's team is never shown by colour alone. */
function YourTeam() {
  return (
    <span className="rounded-full border border-team-ink/50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-team-ink">
      Your team
    </span>
  );
}

function FinalistRow({ finalist }: { finalist: AwardsNightFinalist }) {
  const parts = [finalist.rankLabel, finalist.name];
  if (finalist.teamAbbreviation) parts.push(finalist.teamAbbreviation);
  return (
    <li
      className={cn(
        "flex flex-wrap items-center gap-2 text-lg",
        finalist.isUserTeam ? "font-semibold text-team-ink" : "",
      )}
    >
      <span>{parts.join(" · ")}</span>
      {finalist.isUserTeam ? <YourTeam /> : null}
    </li>
  );
}

function FinalistsBody({ award }: { award: AwardsNightAward }) {
  return (
    <ol className="space-y-2">
      {award.finalists.map((finalist) => (
        <FinalistRow key={finalist.subjectId} finalist={finalist} />
      ))}
    </ol>
  );
}

function WinnerBody({ award }: { award: AwardsNightAward }) {
  const { winner } = award;
  const [firstName, lastName] = splitName(winner.name);
  return (
    <div className="flex items-center gap-4">
      {award.subjectType === "player" ? (
        <PlayerPortrait
          playerId={winner.subjectId}
          firstName={firstName}
          lastName={lastName}
          size="lg"
          portrait={winner.portrait}
        />
      ) : null}
      <div className="space-y-1">
        {winner.teamName ? <p className="text-lg">{winner.teamName}</p> : null}
        {winner.statLine ? (
          <p className="text-sm tabular-nums text-muted">{winner.statLine}</p>
        ) : null}
        {winner.tieBreak ? (
          <p className="text-sm text-muted">Won on tie-break</p>
        ) : null}
        {award.userWon ? <YourTeam /> : null}
      </div>
    </div>
  );
}

function SummaryBody({ view }: { view: AwardsNightView }) {
  return (
    <ul className="space-y-1.5">
      {view.awards.map((award) => (
        <li
          key={award.awardId}
          className="flex flex-wrap items-center gap-2 text-base"
        >
          <span>
            {award.displayName}: {award.winner.name}
            {award.winner.teamAbbreviation
              ? ` (${award.winner.teamAbbreviation})`
              : ""}
          </span>
          {award.userWon ? <YourTeam /> : null}
        </li>
      ))}
    </ul>
  );
}

function IntroBody({ view }: { view: AwardsNightView }) {
  return (
    <div className="space-y-1">
      <p>{view.awards.length} awards</p>
      {view.userWinners > 0 ? <p>{view.userWinners} for your team</p> : null}
    </div>
  );
}

export function buildAwardsNightSteps(view: AwardsNightView): MomentStep[] {
  const eyebrow = `${view.seasonYear} season`;
  const steps: MomentStep[] = [
    {
      id: "intro",
      eyebrow,
      title: "Awards night",
      body: <IntroBody view={view} />,
    },
  ];
  for (const award of view.awards) {
    steps.push(
      {
        id: `${award.awardId}-finalists`,
        eyebrow: award.displayName,
        title: "The finalists",
        body: <FinalistsBody award={award} />,
      },
      {
        id: `${award.awardId}-winner`,
        eyebrow: award.displayName,
        title: award.winner.name,
        body: <WinnerBody award={award} />,
        sting: award.userWon,
      },
    );
  }
  return steps;
}

/** The yearly major awards, smallest to biggest; league-wide. */
export function AwardsNight(props: {
  view: AwardsNightView;
  open: boolean;
  onClose: () => void;
}) {
  const { view } = props;
  if (view.awards.length === 0) return null;
  return (
    <MomentOverlay
      open={props.open}
      onClose={props.onClose}
      label="Awards night"
      steps={buildAwardsNightSteps(view)}
      summary={{
        id: "summary",
        eyebrow: `${view.seasonYear} season`,
        title: "Awards night",
        body: <SummaryBody view={view} />,
      }}
    />
  );
}
