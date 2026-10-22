import { TeamBadge } from "@/components/ui/TeamBadge";
import { TeamThemeScope } from "@/components/ui/TeamThemeScope";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type { PlayoffAttachment } from "@/state/media-timeline/types";
import { formatSeasonLabel } from "@/state/media-timeline/compose-text";
import { attachmentSurfaceClass, teamBrandingFor } from "./attachment-parts";

function scoreText(
  winnerAbbr: string,
  score: { winner: number; loser: number },
): string {
  return `${winnerAbbr} wins ${score.winner}–${score.loser}`;
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
      <div className={attachmentSurfaceClass}>
        <div className="flex items-center gap-3">
          <TeamBadge
            branding={winnerBranding}
            name={winner.displayName}
            size="md"
            decorative
          />
          <div className="min-w-0">
            <p className="font-display text-lg font-bold text-zinc-50">
              {formatSeasonLabel(playoff.seasonYear)} champions
            </p>
            <p className="text-sm text-zinc-400">{winner.displayName}</p>
          </div>
        </div>
      </div>
    );
  }

  if (playoff.event === "champion") {
    return (
      <TeamThemeScope
        branding={winnerBranding}
        className={attachmentSurfaceClass}
      >
        <div className="flex items-center gap-4">
          <TeamBadge
            branding={winnerBranding}
            name={winner.displayName}
            size="lg"
            decorative
          />
          <div className="min-w-0">
            <p className="font-display text-4xl font-extrabold leading-none text-team-ink">
              Champions
            </p>
            <p className="mt-1 text-zinc-50">{winner.displayName}</p>
            <p className="text-sm text-zinc-400">
              {formatSeasonLabel(playoff.seasonYear)}
            </p>
          </div>
        </div>
        {seriesScore ? (
          <p className="mt-3 font-display text-lg font-bold tabular-nums text-zinc-50">
            {scoreText(winner.abbreviation, seriesScore)}
          </p>
        ) : null}
      </TeamThemeScope>
    );
  }

  const total = seriesScore ? seriesScore.winner + seriesScore.loser : 0;
  const tag = playoff.sweep
    ? "Sweep"
    : playoff.wentDistance && total === 7
      ? "Game 7"
      : null;

  return (
    <div className={attachmentSurfaceClass}>
      {playoff.roundLabel ? (
        <p className="text-sm text-zinc-400">{playoff.roundLabel}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2">
          <TeamBadge
            branding={winnerBranding}
            name={winner.abbreviation}
            size="md"
            decorative
          />
          <span className="font-display text-lg font-extrabold uppercase tracking-wide text-zinc-50">
            {winner.abbreviation}
          </span>
        </span>
        {loser ? (
          <span className="flex items-center gap-2">
            <TeamBadge
              branding={teamBrandingFor(context, loser)}
              name={loser.abbreviation}
              size="md"
              decorative
            />
            <span className="font-display text-lg font-medium uppercase tracking-wide text-zinc-400">
              {loser.abbreviation}
            </span>
          </span>
        ) : null}
      </div>
      {seriesScore ? (
        <p className="mt-3 flex items-center gap-2">
          <span className="font-display text-2xl font-extrabold tabular-nums text-zinc-50">
            {scoreText(winner.abbreviation, seriesScore)}
          </span>
          {tag ? (
            <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-sm font-medium text-zinc-300">
              {tag}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
