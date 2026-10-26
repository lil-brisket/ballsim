import Link from "next/link";
import { TeamEntityLink } from "@/components/entity/TeamEntityLink";
import { TeamBadge } from "@/components/ui/TeamBadge";
import { cn, focusRingClass, linkClass } from "@/components/ui/styles";
import type { LeagueScheduleGameRow } from "@/state/league-schedule-selectors";

function statusLabel(game: LeagueScheduleGameRow): string {
  switch (game.status) {
    case "final":
      return "Final";
    case "in_progress":
      return "Live";
    case "postponed":
      return "Postponed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Scheduled";
  }
}

function TeamLine(props: {
  saveId: string;
  teamId: string;
  abbreviation: string;
  name: string;
  branding: LeagueScheduleGameRow["homeBranding"];
  score: number | null;
  won: boolean;
  dimmed: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <TeamBadge
        branding={props.branding}
        name={props.name}
        size="sm"
        decorative
      />
      <TeamEntityLink
        saveId={props.saveId}
        teamId={props.teamId}
        className={cn(
          "min-w-0 truncate hover:text-team-ink",
          props.dimmed ? "text-muted" : "text-ink",
          focusRingClass,
        )}
      >
        <span className="font-display uppercase tracking-wide">
          {props.abbreviation}
        </span>
        <span className="ml-2 hidden text-sm text-faint xl:inline">
          {props.name}
        </span>
      </TeamEntityLink>
      {props.score != null ? (
        <span
          className={cn(
            "ml-auto font-display text-xl tabular-nums",
            props.won ? "font-extrabold text-ink" : "text-muted",
          )}
        >
          {props.score}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Game-day matchup card: badges, both teams, score or status, and the game's
 * actions (box score, watch, manage event). Rings the controlled team's games.
 */
export function ScheduleGameCard(props: {
  saveId: string;
  game: LeagueScheduleGameRow;
  myTeamId: string;
}) {
  const { game, saveId } = props;
  const isFinal = game.status === "final";
  const awayWon = isFinal && (game.awayScore ?? 0) > (game.homeScore ?? 0);
  const homeWon = isFinal && (game.homeScore ?? 0) > (game.awayScore ?? 0);
  const isMine =
    game.homeTeamId === props.myTeamId || game.awayTeamId === props.myTeamId;

  return (
    <article
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-surface-arena px-3 py-2.5",
        isMine ? "border-team-ink/70" : "border-surface-line",
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide">
        <span
          className={cn(
            game.status === "in_progress" ? "text-emerald-400" : "text-faint",
          )}
        >
          {statusLabel(game)}
        </span>
        <span className="flex items-center gap-2">
          {game.competitionType === "playoffs" ? (
            <span className="text-team-ink/80">Playoffs</span>
          ) : null}
          {isMine ? <span className="text-team-ink">Your game</span> : null}
        </span>
      </div>
      <TeamLine
        saveId={saveId}
        teamId={game.awayTeamId}
        abbreviation={game.awayAbbreviation}
        name={game.awayName}
        branding={game.awayBranding}
        score={game.awayScore}
        won={awayWon}
        dimmed={isFinal && !awayWon}
      />
      <TeamLine
        saveId={saveId}
        teamId={game.homeTeamId}
        abbreviation={game.homeAbbreviation}
        name={game.homeName}
        branding={game.homeBranding}
        score={game.homeScore}
        won={homeWon}
        dimmed={isFinal && !homeWon}
      />
      {isFinal || game.canManageEvent ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-surface-line pt-2 text-sm">
          {isFinal ? (
            <Link
              href={`/dashboard/${saveId}/games/${game.gameId}`}
              className={cn(linkClass, focusRingClass)}
            >
              Box score
            </Link>
          ) : null}
          {isFinal && game.canWatch ? (
            <Link
              href={`/dashboard/${saveId}/games/${game.gameId}/watch`}
              className={cn(linkClass, focusRingClass)}
            >
              Watch
            </Link>
          ) : null}
          {game.canManageEvent ? (
            <Link
              href={`/dashboard/${saveId}/schedule/${game.gameId}/event`}
              className={cn(linkClass, focusRingClass)}
            >
              Manage event
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
