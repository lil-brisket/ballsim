import Link from "next/link";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { GameResultLink } from "@/components/owner/GameResultLink";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import { formatGameDate } from "@/presentation/game-date";
import type { TeamBrandingView } from "@/state/team-branding-view";
import {
  cn,
  focusRingClass,
  touchTargetTextClass,
} from "@/components/ui/styles";

export type GameRowProps = {
  saveId: string;
  gameId: string;
  date: string;
  home: boolean;
  opponentAbbreviation: string;
  opponentName?: string;
  opponentTeamId?: string;
  opponentBranding?: TeamBrandingView | null;
  /** Completed result fields */
  teamScore?: number | null;
  opponentScore?: number | null;
  won?: boolean | null;
  /** When true, link completed games to box score */
  canOpenResult?: boolean;
  /** When true, show a Watch link (play-by-play recorded) */
  canWatch?: boolean;
  /** Optional calendar deep link for upcoming games */
  calendarHref?: string;
  className?: string;
};

/**
 * Compact game row for schedules, recent results, and Team Hub upcoming.
 */
export function GameRow(props: GameRowProps) {
  const hasResult =
    props.teamScore != null && props.opponentScore != null && props.won != null;

  const opponentLabel = (
    <span className="inline-flex items-center gap-2">
      <span className="text-faint">{props.home ? "vs" : "@"}</span>
      {props.opponentBranding ? (
        <span
          className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded border border-line-strong"
          style={{ backgroundColor: props.opponentBranding.primaryColor }}
        >
          <TeamLogoMark
            branding={props.opponentBranding}
            size="sm"
            decorative
          />
        </span>
      ) : null}
      {props.opponentTeamId ? (
        <TeamEntityLink
          saveId={props.saveId}
          teamId={props.opponentTeamId}
          className={cn(
            touchTargetTextClass,
            "text-ink hover:text-team-ink",
            focusRingClass,
          )}
        >
          {props.opponentName ?? props.opponentAbbreviation}
        </TeamEntityLink>
      ) : (
        <span className="text-ink">
          {props.opponentName ?? props.opponentAbbreviation}
        </span>
      )}
    </span>
  );

  const score = hasResult ? (
    props.canOpenResult !== false ? (
      <GameResultLink
        saveId={props.saveId}
        gameId={props.gameId}
        canOpen
        className={cn(
          touchTargetTextClass,
          "font-mono text-sm",
          props.won ? "text-success" : "text-danger",
          focusRingClass,
        )}
      >
        {props.won ? "W" : "L"} {props.teamScore}–{props.opponentScore}
      </GameResultLink>
    ) : (
      <span
        className={cn(
          "font-mono text-sm",
          props.won ? "text-success" : "text-danger",
        )}
      >
        {props.won ? "W" : "L"} {props.teamScore}–{props.opponentScore}
      </span>
    )
  ) : props.calendarHref ? (
    <Link
      href={props.calendarHref}
      className={cn(
        touchTargetTextClass,
        "text-sm text-team-ink underline-offset-4 hover:underline",
        focusRingClass,
      )}
    >
      Calendar
    </Link>
  ) : (
    <span className="text-sm text-faint">Scheduled</span>
  );

  return (
    <div
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm",
        props.className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 text-sm text-faint">
          {formatGameDate(props.date)}
        </span>
        {opponentLabel}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {hasResult && props.canWatch ? (
          <Link
            href={`/dashboard/${props.saveId}/games/${props.gameId}/watch`}
            className={cn(
              touchTargetTextClass,
              "text-sm text-team-ink underline-offset-4 hover:underline",
              focusRingClass,
            )}
          >
            Watch
          </Link>
        ) : null}
        {score}
      </div>
    </div>
  );
}
