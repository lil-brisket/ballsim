import Link from "next/link";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { ScoreNumeral } from "@/components/ui/ScoreNumeral";
import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import { readableTextOnBackground } from "@/domain/color-contrast";
import { formatGameDate } from "@/presentation/game-date";
import {
  playerHref,
  type TimelineDisplayContext,
} from "@/state/media-timeline/post-view";
import type {
  GameAttachment,
  TimelinePerformer,
  TimelineTeamRef,
} from "@/state/media-timeline/types";
import type { TeamBrandingView } from "@/state/team-branding-view";
import { teamBrandingFor } from "./attachment-parts";
import { TeamMark } from "./TeamMark";
import { TeamSurface } from "./TeamSurface";

function periodLabel(index: number): string {
  if (index < 4) return `Q${index + 1}`;
  const overtime = index - 3;
  return overtime === 1 ? "OT" : `${overtime}OT`;
}

function seriesLine(
  series: NonNullable<GameAttachment["series"]>,
  home: TimelineTeamRef,
  away: TimelineTeamRef,
): string {
  const homeWins = series.wins[home.teamId] ?? 0;
  const awayWins = series.wins[away.teamId] ?? 0;
  if (homeWins === awayWins) return `Series tied ${homeWins}–${awayWins}`;
  const leader = homeWins > awayWins ? home : away;
  const high = Math.max(homeWins, awayWins);
  const low = Math.min(homeWins, awayWins);
  const verb = high >= series.winsToClinch ? "wins" : "leads";
  return `${leader.abbreviation} ${verb} ${high}–${low}`;
}

/** At most one muted label; "user_team" and the like never get one. */
function notableLabel(attachment: GameAttachment): string | null {
  if (
    attachment.reasons.includes("comeback") &&
    attachment.comebackDeficit > 0
  ) {
    return `Comeback from ${attachment.comebackDeficit} down`;
  }
  if (attachment.reasons.includes("upset")) return "Upset";
  return null;
}

function uniformOf(branding: TeamBrandingView | null) {
  return branding
    ? {
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
      }
    : null;
}

/** One half of the score header, filled with the team's primary colour. */
function ScoreHalf(props: {
  team: TimelineTeamRef;
  branding: TeamBrandingView | null;
  score: number;
  won: boolean;
}) {
  const { branding } = props;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center px-2 py-4 text-center",
        !branding && "bg-surface-high text-ink",
      )}
      style={
        branding
          ? {
              backgroundColor: branding.primaryColor,
              color: readableTextOnBackground(branding.primaryColor),
            }
          : undefined
      }
      data-score-half={props.won ? "winner" : "loser"}
    >
      <div
        className={cn(
          "flex flex-col items-center gap-1",
          !props.won && "opacity-75",
        )}
      >
        <TeamMark branding={branding} size="md" />
        <span
          className={cn(
            "font-display text-lg uppercase tracking-wide",
            props.won ? "font-extrabold" : "font-medium",
          )}
        >
          {props.team.abbreviation}
        </span>
        <ScoreNumeral
          value={props.score}
          size="lg"
          align="center"
          className={cn(
            "[&>span]:text-inherit",
            !props.won && "[&>span]:font-medium",
          )}
        />
      </div>
    </div>
  );
}

function Performer(props: {
  performer: TimelinePerformer;
  branding: TeamBrandingView | null;
  context: TimelineDisplayContext;
}) {
  const { player, line } = props.performer;
  return (
    <div className="flex min-w-0 items-center gap-2 text-sm">
      <PlayerPortrait
        playerId={player.playerId}
        firstName={player.firstName}
        lastName={player.lastName}
        size="sm"
        portrait={props.context.portraits[player.playerId]}
        uniform={uniformOf(props.branding)}
      />
      {/* Narrow cards stack the numbers under the name so it isn't cut. */}
      <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-2">
        <Link
          href={playerHref(props.context.saveId, player.playerId)}
          className={cn(
            "min-w-0 truncate font-medium",
            linkClass,
            focusRingClass,
          )}
        >
          {player.firstName} {player.lastName}
        </Link>
        <span className="shrink-0 tabular-nums text-muted">
          {line.points} PTS · {line.rebounds} REB · {line.assists} AST
        </span>
      </div>
    </div>
  );
}

/**
 * Game attachment as a final-score graphic: split team-colour score header,
 * line score, series state, top performers and a box score link.
 */
export function GameAttachmentCard(props: {
  attachment: GameAttachment;
  context: TimelineDisplayContext;
  boxScoreHref: string | null;
}) {
  const { attachment: a, context, boxScoreHref } = props;
  const { away, home } = a;
  const awayBranding = teamBrandingFor(context, away);
  const homeBranding = teamBrandingFor(context, home);
  const winnerBranding =
    a.winnerTeamId === away.teamId ? awayBranding : homeBranding;
  const tag = a.overtimePeriods > 0 ? "Final/OT" : "Final";
  const shortDate = formatGameDate(a.date);
  const label = `${tag}: ${away.abbreviation} ${a.score.away}, ${home.abbreviation} ${a.score.home}, ${shortDate}`;
  const rows = [
    { team: away, side: "away" as const, branding: awayBranding },
    { team: home, side: "home" as const, branding: homeBranding },
  ];
  const performers = rows.flatMap(({ team, side, branding }) => {
    const performer = a.topPerformers[side];
    return performer ? [{ team, performer, branding }] : [];
  });
  const note = notableLabel(a);

  return (
    <TeamSurface branding={winnerBranding} band="top">
      <div className="space-y-3">
        <span className="sr-only">{label}</span>
        <div aria-hidden="true" className="space-y-1">
          <div className="flex items-stretch overflow-hidden rounded-md">
            <ScoreHalf
              team={away}
              branding={awayBranding}
              score={a.score.away}
              won={a.score.away > a.score.home}
            />
            <ScoreHalf
              team={home}
              branding={homeBranding}
              score={a.score.home}
              won={a.score.home > a.score.away}
            />
          </div>
          <p className="text-center text-sm font-medium uppercase tracking-wide text-soft">
            {tag}
            <span className="normal-case tracking-normal text-muted">
              {" "}
              · {shortDate}
            </span>
          </p>
        </div>

        {a.periodScores.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums text-soft">
              <caption className="sr-only">Score by quarter</caption>
              <thead>
                <tr className="text-muted">
                  <th
                    scope="col"
                    className="py-1 pr-2 text-left font-medium sm:pr-3"
                  >
                    Team
                  </th>
                  {a.periodScores.map((_, index) => (
                    <th
                      key={index}
                      scope="col"
                      className="px-1 py-1 text-right font-medium sm:px-2"
                    >
                      {periodLabel(index)}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="py-1 pl-1 text-right font-medium sm:pl-2"
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ team, side, branding }) => (
                  <tr key={side}>
                    <th
                      scope="row"
                      className="py-1 pr-2 text-left font-medium text-ink sm:pr-3"
                    >
                      <span className="flex items-center gap-1.5">
                        {/* The score header already pairs logo and team; at
                            375px the line score needs the room. */}
                        <span className="hidden sm:inline-flex">
                          <TeamMark branding={branding} size="sm" />
                        </span>
                        {team.abbreviation}
                      </span>
                    </th>
                    {a.periodScores.map((period, index) => (
                      <td key={index} className="px-1 py-1 text-right sm:px-2">
                        {period[side]}
                      </td>
                    ))}
                    <td className="py-1 pl-1 text-right font-semibold text-ink sm:pl-2">
                      {a.score[side]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {a.series ? (
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">
              {seriesLine(a.series, home, away)}
            </span>
            {` · ${a.series.roundLabel}`}
          </p>
        ) : null}
        {note ? <p className="text-sm text-muted">{note}</p> : null}

        {performers.length > 0 ? (
          <div className="space-y-2">
            {performers.map(({ team, performer, branding }) => (
              <Performer
                key={team.teamId}
                performer={performer}
                branding={branding}
                context={context}
              />
            ))}
          </div>
        ) : null}

        {boxScoreHref ? (
          <Link
            href={boxScoreHref}
            className={cn(
              touchTargetTextClass,
              "-mx-2 -mb-2 text-sm",
              linkClass,
              focusRingClass,
            )}
          >
            Box score
          </Link>
        ) : null}
      </div>
    </TeamSurface>
  );
}
