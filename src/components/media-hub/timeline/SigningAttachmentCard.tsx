import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { TeamBadge } from "@/components/ui/TeamBadge";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type { SigningAttachment } from "@/state/media-timeline/types";
import {
  PlayerNameLink,
  attachmentSurfaceClass,
  teamBrandingFor,
} from "./attachment-parts";

export function SigningAttachmentCard(props: {
  attachment: SigningAttachment;
  context: TimelineDisplayContext;
}) {
  const { attachment: signing, context } = props;
  const { player, team } = signing;
  const hasIdentity = Boolean(team || player);

  return (
    <div className={attachmentSurfaceClass}>
      {hasIdentity ? (
        <div className="flex items-center gap-3">
          {team ? (
            <TeamBadge
              branding={teamBrandingFor(context, team)}
              name={team.displayName}
              size="md"
              decorative
            />
          ) : null}
          {player ? (
            <PlayerPortrait
              playerId={player.playerId}
              firstName={player.firstName}
              lastName={player.lastName}
              size="sm"
              portrait={context.portraits[player.playerId] ?? null}
            />
          ) : null}
          <div className="min-w-0">
            {player ? (
              <PlayerNameLink saveId={context.saveId} player={player} />
            ) : null}
            {team ? (
              <p className="text-sm text-zinc-400">{team.displayName}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      {signing.summary ? (
        <p
          className={
            hasIdentity ? "mt-2 text-sm text-zinc-300" : "text-sm text-zinc-300"
          }
        >
          {signing.summary}
        </p>
      ) : null}
    </div>
  );
}
