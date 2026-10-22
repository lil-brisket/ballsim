import Link from "next/link";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { cn, focusRingClass } from "@/components/ui/styles";
import {
  playerHref,
  type TimelineDisplayContext,
} from "@/state/media-timeline/post-view";
import type {
  PerformanceAttachment,
  PerformanceReason,
} from "@/state/media-timeline/types";
import { teamBrandingFor } from "./attachment-parts";
import { StatLine } from "./StatLine";
import { TeamMark } from "./TeamMark";
import { TeamSurface, TeamSurfaceSlab } from "./TeamSurface";

/**
 * Context the stat strip can't show. Reasons that only restate a number on
 * the strip (40 points, blocks, steals, assists) get no note.
 */
function reasonLabel(reason: PerformanceReason): string | null {
  switch (reason) {
    case "twenty_twenty":
      return "20-20 game";
    case "triple_double":
      return "Triple-double";
    case "season_high":
      return "Season high";
    case "forty_points":
    case "blocks":
    case "steals":
    case "assists":
      return null;
  }
}

/** Player performance attachment as a lower third: name slab, portrait, stat strip. */
export function PerformanceAttachmentCard(props: {
  attachment: PerformanceAttachment;
  context: TimelineDisplayContext;
}) {
  const { attachment: a, context } = props;
  const { player, line } = a;
  const branding = teamBrandingFor(context, a.team);
  const opponentBranding = teamBrandingFor(context, a.opponent);
  const uniform = branding
    ? {
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
      }
    : null;
  const chips = Array.from(
    new Set(a.reasons.map(reasonLabel).filter((r): r is string => r !== null)),
  );

  return (
    <TeamSurface branding={branding} band="left">
      <div className="space-y-3">
        {/* Narrow cards put the matchup under the name so the name isn't cut. */}
        <TeamSurfaceSlab className="flex flex-col items-start rounded-md pb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <span className="flex min-w-0 max-w-full items-center gap-2">
            <TeamMark branding={branding} size="sm" />
            <Link
              href={playerHref(context.saveId, player.playerId)}
              className={cn(
                "inline-flex min-h-11 min-w-0 items-center truncate font-display text-lg font-bold text-on-team underline-offset-4 hover:underline",
                focusRingClass,
              )}
            >
              {player.firstName} {player.lastName}
            </Link>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium">
            <span>vs</span>
            <TeamMark branding={opponentBranding} size="sm" />
            <span>{a.opponent.abbreviation}</span>
            <span aria-hidden="true">·</span>
            <span>{a.won ? "W" : "L"}</span>
          </span>
        </TeamSurfaceSlab>

        <div className="flex items-center gap-4">
          <PlayerPortrait
            playerId={player.playerId}
            firstName={player.firstName}
            lastName={player.lastName}
            size="md"
            portrait={context.portraits[player.playerId]}
            uniform={uniform}
          />
          <StatLine
            primary={[
              { label: "PTS", value: String(line.points) },
              { label: "REB", value: String(line.rebounds) },
              { label: "AST", value: String(line.assists) },
            ]}
            secondary={[
              { label: "STL", value: String(line.steals) },
              { label: "BLK", value: String(line.blocks) },
              {
                label: "FG",
                value: `${line.fieldGoalsMade}–${line.fieldGoalsAttempted}`,
              },
              {
                label: "3P",
                value: `${line.threePointersMade}–${line.threePointersAttempted}`,
              },
              { label: "MIN", value: String(Math.round(line.minutes)) },
            ]}
          />
        </div>
        {chips.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <li
                key={chip}
                className="rounded-full bg-zinc-800 px-3 py-0.5 text-sm text-zinc-200"
              >
                {chip}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </TeamSurface>
  );
}
