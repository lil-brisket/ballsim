import Link from "next/link";
import { TeamBadge, type TeamBadgeSize } from "@/components/ui/TeamBadge";
import { cn, focusRingClass } from "@/components/ui/styles";
import { formatGameDate } from "@/presentation/game-date";

export type ScoreBugTeam = {
  abbreviation: string;
  branding:
    | {
        primaryColor: string;
        secondaryColor: string;
        accentColor: string;
        logoId: string;
      }
    | null
    | undefined;
  score: number;
};

function TeamSide(props: {
  team: ScoreBugTeam;
  won: boolean;
  badgeSize: TeamBadgeSize;
  mine: boolean;
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2",
        props.mine && "-ml-1.5 border-l-2 border-team-ink pl-1",
      )}
    >
      <TeamBadge
        branding={props.team.branding}
        name={props.team.abbreviation}
        size={props.badgeSize}
        decorative
      />
      <span
        className={cn(
          "font-display text-lg uppercase tracking-wide",
          props.won ? "font-extrabold text-ink" : "font-medium text-muted",
        )}
      >
        {props.team.abbreviation}
      </span>
      <span
        className={cn(
          "ml-auto font-display text-2xl tabular-nums",
          props.won ? "font-extrabold text-ink" : "font-medium text-muted",
        )}
      >
        {props.team.score}
      </span>
    </span>
  );
}

/**
 * Compact final-score bug: two badges, abbreviations and scores (winner in
 * bold), a Final / OT tag and a short date. Replaces wide result cards.
 * With `href` the whole bug is a link to the game (44px minimum target).
 */
export function ScoreBug(props: {
  teams: readonly [ScoreBugTeam, ScoreBugTeam];
  /** ISO game date. */
  date: string;
  overtime?: boolean;
  /** Index into `teams` of the viewer's team; marks that row and shows W/L. */
  mineIndex?: 0 | 1;
  href?: string;
  badgeSize?: TeamBadgeSize;
  className?: string;
}) {
  const [a, b] = props.teams;
  const aWon = a.score > b.score;
  const bWon = b.score > a.score;
  const mine =
    props.mineIndex === undefined ? null : props.teams[props.mineIndex];
  const rival =
    props.mineIndex === undefined ? null : props.teams[props.mineIndex ^ 1];
  const outcome =
    mine && rival && mine.score !== rival.score
      ? mine.score > rival.score
        ? "W"
        : "L"
      : null;
  const finalTag = props.overtime ? "Final/OT" : "Final";
  const tag = outcome ? `${outcome} · ${finalTag}` : finalTag;
  const shortDate = formatGameDate(props.date);
  const label = `${tag}: ${a.abbreviation} ${a.score}, ${b.abbreviation} ${b.score}, ${shortDate}`;
  const badgeSize = props.badgeSize ?? "sm";

  const body = (
    <>
      <span className="sr-only">{label}</span>
      <span aria-hidden className="flex flex-col gap-1">
        <span className="flex items-center justify-between gap-3 text-sm text-muted">
          <span
            className={cn(
              "font-medium uppercase tracking-wide",
              outcome === "W" && "text-win",
              outcome === "L" && "text-loss",
            )}
          >
            {tag}
          </span>
          <span>{shortDate}</span>
        </span>
        <TeamSide
          team={a}
          won={aWon}
          badgeSize={badgeSize}
          mine={props.mineIndex === 0}
        />
        <TeamSide
          team={b}
          won={bWon}
          badgeSize={badgeSize}
          mine={props.mineIndex === 1}
        />
      </span>
    </>
  );

  const base = cn(
    "block min-h-11 w-full min-w-44 rounded-xl border border-surface-line bg-surface-arena px-3 py-2",
    props.className,
  );

  if (props.href) {
    return (
      <Link
        href={props.href}
        className={cn(base, "hover:border-team-ink", focusRingClass)}
      >
        {body}
      </Link>
    );
  }
  return <div className={base}>{body}</div>;
}
