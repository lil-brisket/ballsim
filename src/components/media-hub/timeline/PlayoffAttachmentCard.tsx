import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type { PlayoffAttachment } from "@/state/media-timeline/types";
import { formatSeasonLabel } from "@/state/media-timeline/compose-text";
import { cn } from "@/components/ui/styles";
import { teamBrandingFor } from "./attachment-parts";
import { TeamMark } from "./TeamMark";
import { TeamSurface, TeamSurfaceSlab } from "./TeamSurface";

function scoreText(
  winnerAbbr: string,
  score: { winner: number; loser: number },
): string {
  return `${winnerAbbr} wins ${score.winner}–${score.loser}`;
}

function Pips(props: { count: number; filled: boolean }) {
  return (
    <span aria-hidden="true" className="flex items-center gap-1.5">
      {Array.from({ length: props.count }, (_, i) => (
        <span
          key={i}
          data-pip={props.filled ? "won" : "lost"}
          className={cn(
            "h-3 w-3 rounded-full border-2 border-team-ink",
            props.filled ? "bg-team-ink" : "bg-transparent",
          )}
        />
      ))}
    </span>
  );
}

export function PlayoffAttachmentCard(props: {
  attachment: PlayoffAttachment;
  context: TimelineDisplayContext;
}) {
  const { attachment: playoff, context } = props;
  const { winner, loser, seriesScore } = playoff;
  const winnerBranding = teamBrandingFor(context, winner);

  if (playoff.event === "previous_champion") {
    return (
      <TeamSurface branding={winnerBranding} band="top">
        <div className="flex items-center gap-3">
          <TeamMark branding={winnerBranding} size="md" />
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-zinc-50">
              {formatSeasonLabel(playoff.seasonYear)} champions
            </p>
            <p className="text-sm text-zinc-400">{winner.displayName}</p>
          </div>
        </div>
      </TeamSurface>
    );
  }

  if (playoff.event === "champion") {
    return (
      <TeamSurface branding={winnerBranding} band="top">
        <TeamSurfaceSlab className="-mx-4 flex items-center gap-4 rounded-md">
          <TeamMark branding={winnerBranding} size="lg" />
          <div className="min-w-0">
            <p className="font-display text-xl font-extrabold leading-tight">
              Champions
            </p>
            <p className="text-sm">{formatSeasonLabel(playoff.seasonYear)}</p>
          </div>
        </TeamSurfaceSlab>
        <p className="mt-3 text-zinc-50">{winner.displayName}</p>
        {seriesScore ? (
          <p className="mt-1 font-display text-lg font-bold tabular-nums text-zinc-50">
            {scoreText(winner.abbreviation, seriesScore)}
          </p>
        ) : null}
      </TeamSurface>
    );
  }

  const total = seriesScore ? seriesScore.winner + seriesScore.loser : 0;
  const tag = playoff.sweep
    ? "Sweep"
    : playoff.wentDistance && total === 7
      ? "Game 7"
      : null;
  const loserBranding = loser ? teamBrandingFor(context, loser) : null;

  return (
    <TeamSurface branding={winnerBranding} band="top">
      {playoff.roundLabel ? (
        <p className="text-sm text-zinc-400">{playoff.roundLabel}</p>
      ) : null}
      <div className="mt-2 space-y-2">
        <div className="flex items-center gap-3">
          <TeamMark branding={winnerBranding} size="md" />
          <span className="w-12 font-display text-lg font-extrabold uppercase tracking-wide text-zinc-50">
            {winner.abbreviation}
          </span>
          {seriesScore ? <Pips count={seriesScore.winner} filled /> : null}
        </div>
        {loser ? (
          <div className="flex items-center gap-3">
            <TeamMark branding={loserBranding} size="md" />
            <span className="w-12 font-display text-lg font-medium uppercase tracking-wide text-zinc-400">
              {loser.abbreviation}
            </span>
            {seriesScore ? (
              <Pips count={seriesScore.loser} filled={false} />
            ) : null}
          </div>
        ) : null}
      </div>
      {seriesScore ? (
        <p className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-display text-2xl font-extrabold tabular-nums text-zinc-50">
            {scoreText(winner.abbreviation, seriesScore)}
          </span>
          <span className="sr-only">
            {seriesScore.winner} games to {seriesScore.loser}
          </span>
          {tag ? (
            <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-sm font-medium text-zinc-300">
              {tag}
            </span>
          ) : null}
        </p>
      ) : null}
    </TeamSurface>
  );
}
