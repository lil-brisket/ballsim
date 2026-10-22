import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { formatGameDate } from "@/presentation/game-date";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type { InjuryAttachment } from "@/state/media-timeline/types";
import { PlayerNameLink, teamBrandingFor } from "./attachment-parts";
import { TeamMark } from "./TeamMark";
import { TeamSurface } from "./TeamSurface";

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

  if (!hasIdentity && !severityLabel && !bodyPart && !returnText) return null;

  const branding = team ? teamBrandingFor(context, team) : null;
  const uniform = branding
    ? {
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
      }
    : null;

  return (
    <TeamSurface branding={branding} band="left">
      {hasIdentity ? (
        <div className="flex items-center gap-4">
          {player ? (
            <PlayerPortrait
              playerId={player.playerId}
              firstName={player.firstName}
              lastName={player.lastName}
              size="md"
              portrait={context.portraits[player.playerId] ?? null}
              uniform={uniform}
            />
          ) : (
            <TeamMark branding={branding} size="lg" />
          )}
          <div className="min-w-0">
            {player ? (
              <PlayerNameLink
                saveId={context.saveId}
                player={player}
                className="font-display text-lg"
              />
            ) : null}
            {team ? (
              <p className="flex items-center gap-2 text-sm text-zinc-400">
                {player ? <TeamMark branding={branding} size="sm" /> : null}
                <span>{player ? team.abbreviation : team.displayName}</span>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
      {severityLabel || bodyPart ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {severityLabel ? (
            <span
              data-injury-chip
              className="inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-sm font-semibold capitalize text-warning"
            >
              {severityLabel}
            </span>
          ) : null}
          {bodyPart ? (
            <span className="text-sm text-zinc-400">{bodyPart}</span>
          ) : null}
        </div>
      ) : null}
      {returnText ? (
        <p className="mt-2 text-sm text-zinc-400">{returnText}</p>
      ) : null}
    </TeamSurface>
  );
}
