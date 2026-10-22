import Link from "next/link";
import {
  cn,
  focusRingClass,
  linkClass,
  panelClass,
} from "@/components/ui/styles";
import { toBrandingView } from "@/state/team-branding-view";
import type { TeamBrandingView } from "@/state/team-branding-view";
import { playerHref } from "@/state/media-timeline/post-view";
import type { TimelineDisplayContext } from "@/state/media-timeline/post-view";
import type {
  TimelinePlayerRef,
  TimelineTeamRef,
} from "@/state/media-timeline/types";

/** The single bordered surface every attachment card draws. */
export const attachmentSurfaceClass = `${panelClass} p-4`;

export function teamBrandingFor(
  context: TimelineDisplayContext,
  team: TimelineTeamRef,
): TeamBrandingView | null {
  return context.teams[team.teamId]?.branding ?? toBrandingView(team.branding);
}

export function teamHrefFor(
  context: TimelineDisplayContext,
  teamId: string,
): string | null {
  return context.teams[teamId]?.href ?? null;
}

export function playerFullName(player: TimelinePlayerRef): string {
  return `${player.firstName} ${player.lastName}`.trim();
}

/** "2026–27" for a season that starts in `startYear`. */
export function seasonLabel(startYear: number): string {
  return `${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function PlayerNameLink(props: {
  saveId: string;
  player: TimelinePlayerRef;
  className?: string;
}) {
  return (
    <Link
      href={playerHref(props.saveId, props.player.playerId)}
      className={cn(
        linkClass,
        focusRingClass,
        "inline-flex min-h-11 items-center touch-manipulation active:opacity-80",
        props.className,
      )}
    >
      {playerFullName(props.player)}
    </Link>
  );
}
