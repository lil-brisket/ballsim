import { formatGameDate } from "@/presentation/game-date";
import { formatSeasonLabel } from "@/state/media-timeline/compose-text";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type { AwardRaceAttachment } from "@/state/media-timeline/types";
import { PlayerNameLink, teamBrandingFor } from "./attachment-parts";
import { TeamSurface } from "./TeamSurface";

export function AwardRaceAttachmentCard(props: {
  attachment: AwardRaceAttachment;
  context: TimelineDisplayContext;
}) {
  const { attachment: race, context } = props;
  const leadTeam = race.contenders[0]?.team ?? null;
  const branding = leadTeam ? teamBrandingFor(context, leadTeam) : null;

  return (
    <TeamSurface branding={branding} band="top">
      <p className="font-display text-xl font-bold leading-tight text-ink">
        {race.awardName} race
      </p>
      <p className="mt-0.5 text-sm text-muted">
        {formatSeasonLabel(race.seasonYear)} season · through{" "}
        {formatGameDate(race.throughDate)}
      </p>

      <ol className="mt-3 divide-y divide-line" data-award-race="">
        {race.contenders.map((contender) => (
          <li
            key={contender.rank}
            className="flex items-center gap-3 py-0.5"
            data-race-rank={contender.rank}
          >
            <span className="w-5 shrink-0 text-right font-display text-lg text-muted">
              {contender.rank}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {contender.player ? (
                <PlayerNameLink
                  saveId={context.saveId}
                  player={contender.player}
                />
              ) : (
                <span className="text-ink">{contender.coachName}</span>
              )}
            </span>
            {contender.team ? (
              <span className="shrink-0 text-sm uppercase tracking-wide text-muted">
                {contender.team.abbreviation}
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      {race.previousLeaderName ? (
        <p className="mt-3 text-sm text-muted">
          Previous leader: {race.previousLeaderName}
        </p>
      ) : null}
    </TeamSurface>
  );
}
