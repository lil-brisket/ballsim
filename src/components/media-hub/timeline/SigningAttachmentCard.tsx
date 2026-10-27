import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type { SigningAttachment } from "@/state/media-timeline/types";
import { PlayerNameLink, teamBrandingFor } from "./attachment-parts";
import { TeamSurface, TeamSurfaceSlab } from "./TeamSurface";

export function SigningAttachmentCard(props: {
  attachment: SigningAttachment;
  context: TimelineDisplayContext;
}) {
  const { attachment: signing, context } = props;
  const { player, team } = signing;
  const branding = team ? teamBrandingFor(context, team) : null;
  const uniform = branding
    ? {
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
      }
    : null;

  return (
    <TeamSurface branding={branding} band="left">
      {team ? (
        <TeamSurfaceSlab className="mb-4 flex items-center gap-2 rounded-md">
          {branding ? (
            <TeamLogoMark branding={branding} size="sm" decorative />
          ) : null}
          <span className="min-w-0 font-display text-lg font-bold">
            {team.displayName}
          </span>
        </TeamSurfaceSlab>
      ) : null}
      {player ? (
        <div className="flex items-center gap-4">
          <PlayerPortrait
            playerId={player.playerId}
            firstName={player.firstName}
            lastName={player.lastName}
            size="md"
            portrait={context.portraits[player.playerId] ?? null}
            uniform={uniform}
          />
          <div className="min-w-0">
            <PlayerNameLink
              saveId={context.saveId}
              player={player}
              className="font-display text-lg"
            />
            {signing.summary ? (
              <p className="text-sm text-soft">{signing.summary}</p>
            ) : null}
          </div>
        </div>
      ) : signing.summary ? (
        <p className="text-sm text-soft">{signing.summary}</p>
      ) : null}
    </TeamSurface>
  );
}
