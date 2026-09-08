import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { GameResultLink } from "@/components/owner/GameResultLink";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";
import type { TeamBrandingView } from "@/state/team-branding-view";
import { cn, focusRingClass } from "@/components/ui/styles";

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
  className?: string;
};

function TeamMark(props: {
  branding?: TeamBrandingView | null;
  abbreviation: string;
}) {
  if (props.branding) {
    return (
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded border border-zinc-700"
        style={{ backgroundColor: props.branding.primaryColor }}
      >
        <TeamLogoMark branding={props.branding} size="sm" decorative />
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-700 font-mono text-[9px] text-zinc-400">
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
        className={cn("text-zinc-100 hover:text-amber-400", focusRingClass)}
      >
        {props.awayAbbreviation}
      </TeamEntityLink>
      <span className="text-zinc-600">@</span>
      <TeamMark
        branding={props.homeBranding}
        abbreviation={props.homeAbbreviation}
      />
      <TeamEntityLink
        saveId={props.saveId}
        teamId={props.homeTeamId}
        className={cn("text-zinc-100 hover:text-amber-400", focusRingClass)}
      >
        {props.homeAbbreviation}
      </TeamEntityLink>
      {props.competitionType === "playoffs" ? (
        <span className="font-mono text-[0.65rem] uppercase text-amber-500/80">
          Playoffs
        </span>
      ) : null}
    </div>
  );

  const score = isFinal ? (
    <span className="font-mono text-sm text-zinc-200">
      {props.awayScore}–{props.homeScore}
    </span>
  ) : props.status === "in_progress" ? (
    <span className="text-xs font-medium text-emerald-400">Live</span>
  ) : props.status === "postponed" ? (
    <span className="text-xs text-zinc-500">Postponed</span>
  ) : props.status === "cancelled" ? (
    <span className="text-xs text-zinc-500">Cancelled</span>
  ) : (
    <span className="text-xs text-zinc-500">Scheduled</span>
  );

  const body = (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-zinc-800 px-3 py-2 text-sm",
        props.className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 font-mono text-xs text-zinc-500">
          {props.date}
        </span>
        {matchup}
      </div>
      <div className="shrink-0">{score}</div>
    </div>
  );

  if (isFinal) {
    return (
      <GameResultLink saveId={props.saveId} gameId={props.gameId} canOpen>
        {body}
      </GameResultLink>
    );
  }

  return body;
}
