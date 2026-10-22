import Link from "next/link";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { cn, focusRingClass } from "@/components/ui/styles";
import { readableTextOnBackground } from "@/domain/color-contrast";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type { TradeAttachment } from "@/state/media-timeline/types";
import {
  PlayerNameLink,
  teamBrandingFor,
  teamHrefFor,
} from "./attachment-parts";
import { TeamSurface } from "./TeamSurface";

const COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
};

/** Decorative two-way arrow between the team columns (hidden when stacked). */
function SwapArrow() {
  return (
    <span
      aria-hidden="true"
      data-trade-arrow=""
      className="pointer-events-none absolute left-1/2 top-3 z-10 hidden h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-50 sm:flex"
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 8h15m-4-4 4 4-4 4" />
        <path d="M20 16H5m4-4-4 4 4 4" />
      </svg>
    </span>
  );
}

export function TradeAttachmentCard(props: {
  attachment: TradeAttachment;
  context: TimelineDisplayContext;
}) {
  const { attachment: trade, context } = props;
  const firstBranding = trade.teams[0]
    ? teamBrandingFor(context, trade.teams[0])
    : null;

  return (
    <TeamSurface branding={firstBranding} band="top">
      <div className="relative">
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
            const branding = teamBrandingFor(context, team);
            const uniform = branding
              ? {
                  primaryColor: branding.primaryColor,
                  secondaryColor: branding.secondaryColor,
                }
              : null;
            const headerColor = branding
              ? readableTextOnBackground(branding.primaryColor)
              : undefined;
            return (
              <section
                key={team.teamId}
                aria-label={`${team.displayName} trade`}
                className="min-w-0"
              >
                <div
                  data-trade-header=""
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2",
                    !branding && "bg-zinc-800 text-zinc-50",
                  )}
                  style={
                    branding
                      ? {
                          backgroundColor: branding.primaryColor,
                          color: headerColor,
                        }
                      : undefined
                  }
                >
                  {branding ? (
                    <TeamLogoMark branding={branding} size="md" decorative />
                  ) : null}
                  {href ? (
                    <Link
                      href={href}
                      style={headerColor ? { color: headerColor } : undefined}
                      className={cn(
                        focusRingClass,
                        "inline-flex min-h-11 min-w-0 items-center font-display text-lg font-bold underline-offset-2 hover:underline touch-manipulation active:opacity-80",
                      )}
                    >
                      {team.displayName}
                    </Link>
                  ) : (
                    <span className="min-w-0 font-display text-lg font-bold">
                      {team.displayName}
                    </span>
                  )}
                </div>
                {received.length > 0 ? (
                  <>
                    <p className="mt-3 text-sm text-zinc-400">Receives</p>
                    <ul className="mt-1 space-y-2">
                      {received.map((movement) => {
                        const p = movement.player;
                        return (
                          <li
                            key={p.playerId}
                            className="flex items-center gap-3"
                          >
                            <PlayerPortrait
                              playerId={p.playerId}
                              firstName={p.firstName}
                              lastName={p.lastName}
                              size="sm"
                              portrait={context.portraits[p.playerId] ?? null}
                              uniform={uniform}
                            />
                            <PlayerNameLink
                              saveId={context.saveId}
                              player={p}
                              className="min-w-0"
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : null}
              </section>
            );
          })}
        </div>
        {trade.teams.length === 2 ? <SwapArrow /> : null}
      </div>
      {trade.otherPieces.length > 0 ? (
        <ul className="mt-4 space-y-1">
          {trade.otherPieces.map((piece) => (
            <li key={piece} className="text-sm text-zinc-400">
              {piece}
            </li>
          ))}
        </ul>
      ) : null}
    </TeamSurface>
  );
}
