import Link from "next/link";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { cn, focusRingClass, linkClass } from "@/components/ui/styles";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type { TradeAttachment } from "@/state/media-timeline/types";
import {
  PlayerNameLink,
  attachmentSurfaceClass,
  teamBrandingFor,
  teamHrefFor,
} from "./attachment-parts";

const COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
};

export function TradeAttachmentCard(props: {
  attachment: TradeAttachment;
  context: TimelineDisplayContext;
}) {
  const { attachment: trade, context } = props;

  return (
    <div className={attachmentSurfaceClass}>
      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          COLUMNS[trade.teams.length] ?? "sm:grid-cols-3",
        )}
      >
        {trade.teams.map((team) => {
          const received = trade.movements.filter(
            (movement) => movement.toTeamId === team.teamId,
          );
          const href = teamHrefFor(context, team.teamId);
          return (
            <section
              key={team.teamId}
              aria-label={`${team.displayName} trade`}
              className="min-w-0"
            >
              <div className="flex items-center gap-2">
                <TeamBadge
                  branding={teamBrandingFor(context, team)}
                  name={team.displayName}
                  size="md"
                  decorative
                />
                {href ? (
                  <Link
                    href={href}
                    className={cn(
                      linkClass,
                      focusRingClass,
                      "inline-flex min-h-11 items-center font-semibold touch-manipulation active:opacity-80",
                    )}
                  >
                    {team.displayName}
                  </Link>
                ) : (
                  <span className="font-semibold text-zinc-50">
                    {team.displayName}
                  </span>
                )}
              </div>
              {received.length > 0 ? (
                <>
                  <p className="mt-1 text-sm text-zinc-400">Receives</p>
                  <ul>
                    {received.map((movement) => (
                      <li key={movement.player.playerId}>
                        <PlayerNameLink
                          saveId={context.saveId}
                          player={movement.player}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          );
        })}
      </div>
      {trade.otherPieces.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-zinc-800 pt-3">
          {trade.otherPieces.map((piece) => (
            <li key={piece} className="text-sm text-zinc-400">
              {piece}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
