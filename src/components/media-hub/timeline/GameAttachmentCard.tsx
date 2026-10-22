import Link from "next/link";
import { PlayerPortrait } from "@/components/basketball/PlayerPortrait";
import { ScoreBug } from "@/components/ui/ScoreBug";
import {
  cn,
  focusRingClass,
  linkClass,
  touchTargetTextClass,
} from "@/components/ui/styles";
import {
  playerHref,
  type TimelineDisplayContext,
} from "@/state/media-timeline/post-view";
import type {
  GameAttachment,
  TimelinePerformer,
  TimelineTeamRef,
} from "@/state/media-timeline/types";
import { attachmentSurfaceClass } from "./attachment-parts";

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

function Performer(props: {
  team: TimelineTeamRef;
  performer: TimelinePerformer;
  context: TimelineDisplayContext;
}) {
  const { player, line } = props.performer;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <PlayerPortrait
        playerId={player.playerId}
        firstName={player.firstName}
        lastName={player.lastName}
        size="sm"
        portrait={props.context.portraits[player.playerId]}
      />
      <div className="min-w-0 text-sm">
        <Link
          href={playerHref(props.context.saveId, player.playerId)}
          className={cn(
            "block truncate font-medium",
            linkClass,
            focusRingClass,
          )}
        >
          {player.firstName} {player.lastName}
        </Link>
        <p className="text-zinc-400">
          {props.team.abbreviation} · {line.points} pts · {line.rebounds} reb ·{" "}
          {line.assists} ast
        </p>
      </div>
    </div>
  );
}

/**
 * Game attachment: final score bug, line score, series state, top performers
 * and a box score link, on a single bordered surface.
 */
export function GameAttachmentCard(props: {
  attachment: GameAttachment;
  context: TimelineDisplayContext;
  boxScoreHref: string | null;
}) {
  const { attachment: a, context, boxScoreHref } = props;
  const { away, home } = a;
  const brandingOf = (team: TimelineTeamRef) =>
    context.teams[team.teamId]?.branding ?? null;
  const rows = [
    { team: away, side: "away" as const },
    { team: home, side: "home" as const },
  ];
  const performers = rows.flatMap(({ team, side }) => {
    const performer = a.topPerformers[side];
    return performer ? [{ team, performer }] : [];
  });
  const note = notableLabel(a);

  return (
    <div className={cn(attachmentSurfaceClass, "space-y-3")}>
      <ScoreBug
        className="!min-h-0 !border-0 !bg-transparent !p-0"
        badgeSize="md"
        date={a.date}
        overtime={a.overtimePeriods > 0}
        teams={[
          {
            abbreviation: away.abbreviation,
            branding: brandingOf(away),
            score: a.score.away,
          },
          {
            abbreviation: home.abbreviation,
            branding: brandingOf(home),
            score: a.score.home,
          },
        ]}
      />

      {a.periodScores.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-zinc-300">
            <caption className="sr-only">Score by quarter</caption>
            <thead>
              <tr className="text-zinc-400">
                <th scope="col" className="py-1 pr-3 text-left font-medium">
                  Team
                </th>
                {a.periodScores.map((_, index) => (
                  <th
                    key={index}
                    scope="col"
                    className="px-2 py-1 text-right font-medium"
                  >
                    {periodLabel(index)}
                  </th>
                ))}
                <th scope="col" className="py-1 pl-2 text-right font-medium">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ team, side }) => (
                <tr key={side}>
                  <th
                    scope="row"
                    className="py-1 pr-3 text-left font-medium text-zinc-200"
                  >
                    {team.abbreviation}
                  </th>
                  {a.periodScores.map((period, index) => (
                    <td
                      key={index}
                      className="px-2 py-1 text-right font-mono tabular-nums"
                    >
                      {period[side]}
                    </td>
                  ))}
                  <td className="py-1 pl-2 text-right font-mono font-semibold tabular-nums text-zinc-50">
                    {a.score[side]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {a.series || note ? (
        <p className="text-sm text-zinc-400">
          {a.series ? (
            <>
              <span className="font-medium text-zinc-200">
                {seriesLine(a.series, home, away)}
              </span>
              {` · ${a.series.roundLabel}`}
            </>
          ) : null}
          {a.series && note ? " · " : null}
          {note}
        </p>
      ) : null}

      {performers.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {performers.map(({ team, performer }) => (
            <Performer
              key={team.teamId}
              team={team}
              performer={performer}
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
  );
}
