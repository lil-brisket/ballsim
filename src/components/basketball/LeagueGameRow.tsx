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

export type LeagueGameRowProps = {
  saveId: string;
  gameId: string;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  homeAbbreviation: string;
  awayAbbreviation: string;
  homeName?: string;
  awayName?: string;
  homeBranding?: TeamBrandingView | null;
  awayBranding?: TeamBrandingView | null;
  homeScore?: number | null;
  awayScore?: number | null;
  status?: string;
  competitionType?: string;
  /** When true (and final), show a Watch link (play-by-play recorded) */
  canWatch?: boolean;
  className?: string;
};

function TeamMark(props: {
  branding?: TeamBrandingView | null;
  abbreviation: string;
}) {
  if (props.branding) {
    return (
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded border border-line-strong"
        style={{ backgroundColor: props.branding.primaryColor }}
      >
        <TeamLogoMark branding={props.branding} size="sm" decorative />
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-line-strong font-mono text-[9px] text-muted">
      {props.abbreviation.slice(0, 3)}
    </span>
  );
}

/**
 * Compact league-wide game row: both teams + score + entity links.
 */
export function LeagueGameRow(props: LeagueGameRowProps) {
  const isFinal =
    props.status === "final" ||
    (props.homeScore != null && props.awayScore != null);

  const matchup = (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <TeamMark
        branding={props.awayBranding}
        abbreviation={props.awayAbbreviation}
      />
      <TeamEntityLink
        saveId={props.saveId}
        teamId={props.awayTeamId}
        className={cn(
          touchTargetTextClass,
          "text-ink hover:text-team-ink",
          focusRingClass,
        )}
      >
        {props.awayAbbreviation}
      </TeamEntityLink>
      <span className="text-disabled">@</span>
      <TeamMark
        branding={props.homeBranding}
        abbreviation={props.homeAbbreviation}
      />
      <TeamEntityLink
        saveId={props.saveId}
        teamId={props.homeTeamId}
        className={cn(
          touchTargetTextClass,
          "text-ink hover:text-team-ink",
          focusRingClass,
        )}
      >
        {props.homeAbbreviation}
      </TeamEntityLink>
      {props.competitionType === "playoffs" ? (
        <span className="text-sm text-team-ink/80">Playoffs</span>
      ) : null}
    </div>
  );

  const score = isFinal ? (
    <GameResultLink
      saveId={props.saveId}
      gameId={props.gameId}
      canOpen
      className={cn(
        touchTargetTextClass,
        "font-mono text-sm text-ink",
        focusRingClass,
      )}
    >
      {props.awayScore}–{props.homeScore}
    </GameResultLink>
  ) : props.status === "in_progress" ? (
    <span className="text-sm font-medium text-success">Live</span>
  ) : props.status === "postponed" ? (
    <span className="text-sm text-faint">Postponed</span>
  ) : props.status === "cancelled" ? (
    <span className="text-sm text-faint">Cancelled</span>
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
        {matchup}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {isFinal && props.canWatch ? (
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
