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
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
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
  href?: string;
  badgeSize?: TeamBadgeSize;
  className?: string;
}) {
  const [a, b] = props.teams;
  const aWon = a.score > b.score;
  const bWon = b.score > a.score;
  const tag = props.overtime ? "Final/OT" : "Final";
  const shortDate = formatGameDate(props.date);
  const label = `${tag}: ${a.abbreviation} ${a.score}, ${b.abbreviation} ${b.score}, ${shortDate}`;
  const badgeSize = props.badgeSize ?? "sm";

  const body = (
    <>
      <span className="sr-only">{label}</span>
      <span aria-hidden className="flex flex-col gap-1">
        <span className="flex items-center justify-between gap-3 text-sm text-muted">
          <span className="font-medium uppercase tracking-wide">{tag}</span>
          <span>{shortDate}</span>
        </span>
        <TeamSide team={a} won={aWon} badgeSize={badgeSize} />
        <TeamSide team={b} won={bWon} badgeSize={badgeSize} />
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
