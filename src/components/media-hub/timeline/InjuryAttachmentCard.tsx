import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { formatGameDate } from "@/presentation/game-date";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type { InjuryAttachment } from "@/state/media-timeline/types";
import {
  PlayerNameLink,
  attachmentSurfaceClass,
  teamBrandingFor,
} from "./attachment-parts";

const SEVERITY_LABEL = {
  minor: "minor",
  moderate: "questionable",
  major: "injured",
  severe: "out",
} as const;

function bodyPartWords(bodyPart: string): string {
  const words = bodyPart.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function InjuryAttachmentCard(props: {
  attachment: InjuryAttachment;
  context: TimelineDisplayContext;
}) {
  const { attachment: injury, context } = props;
  const { player, team, severity, expectedReturn } = injury;
  const bodyPart = injury.bodyPart ? bodyPartWords(injury.bodyPart) : null;
  const severityLabel = severity ? SEVERITY_LABEL[severity] : null;
  const returnText = expectedReturn
    ? expectedReturn.earliest === expectedReturn.latest
      ? `Expected back ${formatGameDate(expectedReturn.earliest)}`
      : `Expected back ${formatGameDate(expectedReturn.earliest)} – ${formatGameDate(expectedReturn.latest)}`
    : null;
  const hasIdentity = Boolean(player || team);
  const hasDetails = Boolean(severityLabel || bodyPart);

  if (!hasIdentity && !hasDetails && !returnText) return null;

  return (
    <div className={attachmentSurfaceClass}>
      {hasIdentity ? (
        <div className="flex items-center gap-3">
          {player ? (
            <PlayerPortrait
              playerId={player.playerId}
              firstName={player.firstName}
              lastName={player.lastName}
              size="sm"
              portrait={context.portraits[player.playerId] ?? null}
            />
          ) : team ? (
            <TeamBadge
              branding={teamBrandingFor(context, team)}
              name={team.displayName}
              size="sm"
              decorative
            />
          ) : null}
          <div className="min-w-0">
            {player ? (
              <PlayerNameLink saveId={context.saveId} player={player} />
            ) : null}
            {team ? (
              <p className="text-sm text-zinc-400">
                {player ? team.abbreviation : team.displayName}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {hasDetails ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {severityLabel ? <StatusBadge label={severityLabel} /> : null}
          {bodyPart ? (
            <span className="text-sm text-zinc-300">{bodyPart}</span>
          ) : null}
        </div>
      ) : null}
      {returnText ? (
        <p className="mt-2 text-sm text-zinc-400">{returnText}</p>
      ) : null}
    </div>
  );
}
