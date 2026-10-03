import Link from "next/link";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { GameResultLink } from "@/components/owner/GameResultLink";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
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
      <span className="text-zinc-500">{props.home ? "vs" : "@"}</span>
      {props.opponentBranding ? (
        <span
          className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded border border-zinc-700"
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
            "text-zinc-100 hover:text-amber-400",
            focusRingClass,
          )}
        >
          {props.opponentName ?? props.opponentAbbreviation}
        </TeamEntityLink>
      ) : (
        <span className="text-zinc-100">
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
          props.won ? "text-emerald-400" : "text-rose-400",
          focusRingClass,
        )}
      >
        {props.won ? "W" : "L"} {props.teamScore}–{props.opponentScore}
      </GameResultLink>
    ) : (
      <span
        className={cn(
          "font-mono text-sm",
          props.won ? "text-emerald-400" : "text-rose-400",
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
        "text-xs text-amber-400 hover:text-amber-300",
        focusRingClass,
      )}
    >
      Calendar
    </Link>
  ) : (
    <span className="text-xs text-zinc-500">Scheduled</span>
  );

  return (
    <div
      className={cn(
        "flex min-h-11 items-center justify-between gap-3 rounded-lg border border-zinc-800 px-3 py-2 text-sm",
        props.className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 font-mono text-xs text-zinc-500">
          {props.date}
        </span>
        {opponentLabel}
      </div>
      <div className="shrink-0">{score}</div>
    </div>
  );
}
