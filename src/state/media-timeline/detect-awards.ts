import type { ImportanceLevel } from "@/domain/entities/event-source";
import type { AwardResult } from "@/domain/entities/awards";
import { getAwardDefinition } from "@/systems/awards/award-definitions";
import { awardCalendarDate } from "@/systems/calendar/project-calendar-events";
import { lastArchivedGameDate } from "./archive-dates";
import type { DetectorInput } from "./detector-input";
import type { AwardAttachment, TimelinePost } from "./types";

const YEARLY_NOTABILITY: Partial<Record<AwardResult["awardId"], number>> = {
  mvp: 95,
  coach_of_year: 70,
};

/**
 * Monthly and yearly awards for the current season, plus the previous
 * season's yearly awards. Legacy midseason awards are skipped.
 */
export function detectAwards(input: DetectorInput): TimelinePost[] {
  const { state, ctx } = input;
  const previousSeasonDates = new Map<string, string | null>();
  const posts: TimelinePost[] = [];

  for (const award of Object.values(state.business.awards.results)) {
    if (award.awardId.startsWith("midseason_") || award.period === "midseason")
      continue;
    const isCurrent = award.seasonId === ctx.seasonId;
    const isPrevious =
      !isCurrent &&
      award.cadence === "yearly" &&
      award.seasonYear === ctx.seasonYear - 1;
    if (!isCurrent && !isPrevious) continue;

    let date: string | null;
    if (award.cadence === "monthly") {
      date = awardCalendarDate(state, award);
    } else if (isCurrent) {
      // Yearly awards are decided the day the regular season ends.
      date = ctx.lastRegularSeasonDate;
    } else {
      if (!previousSeasonDates.has(award.seasonId)) {
        previousSeasonDates.set(
          award.seasonId,
          lastArchivedGameDate(state, award.seasonId, "regular_season"),
        );
      }
      date = previousSeasonDates.get(award.seasonId) ?? null;
    }
    if (date === null) continue;

    const post = toPost(input, award, date);
    if (post) posts.push(post);
  }
  return posts;
}

function toPost(
  input: DetectorInput,
  award: AwardResult,
  date: string,
): TimelinePost | null {
  const { state, refs } = input;
  const definition = getAwardDefinition(award.awardId);
  const isPlayer = award.winner.subjectType === "player";
  const winner = isPlayer ? refs.player(award.winner.subjectId) : null;
  const coach = isPlayer ? null : state.world.coaches[award.winner.subjectId];
  if (isPlayer && !winner) return null;
  if (!isPlayer && !coach) return null;
  const team = award.winner.teamId ? refs.team(award.winner.teamId) : null;
  const snapshot = award.context.statSnapshot;
  const runnerUpCandidate = award.candidates.find((c) => c.rank === 2);
  const runnerUp = runnerUpCandidate
    ? runnerUpName(input, award, runnerUpCandidate.subjectId)
    : null;

  const notability =
    award.cadence === "yearly"
      ? (YEARLY_NOTABILITY[award.awardId] ?? 80)
      : award.awardId === "player_of_month"
        ? 60
        : 50;
  const importance: ImportanceLevel =
    award.awardId === "mvp"
      ? "critical"
      : award.cadence === "yearly"
        ? "high"
        : "medium";

  const attachment: AwardAttachment = {
    type: "award",
    awardResultId: award.id,
    awardId: award.awardId,
    awardName: definition.displayName,
    cadence: award.cadence,
    seasonYear: award.seasonYear,
    period: award.period,
    winner,
    winnerCoachName: coach ? `${coach.firstName} ${coach.lastName}` : null,
    team,
    perGame:
      isPlayer && snapshot
        ? {
            points: snapshot.perGame.points,
            rebounds: snapshot.perGame.rebounds,
            assists: snapshot.perGame.assists,
          }
        : null,
    teamRecord: snapshot
      ? { wins: snapshot.teamRecord.wins, losses: snapshot.teamRecord.losses }
      : null,
    runnerUp:
      runnerUp === null
        ? null
        : {
            name: runnerUp,
            teamAbbreviation: runnerUpCandidate?.teamId
              ? refs.team(runnerUpCandidate.teamId).abbreviation
              : null,
          },
  };

  return {
    id: `award:${award.id}`,
    occurredOn: date,
    kind: "award",
    importance,
    notability,
    relevance: 0,
    teamIds: team ? [team.teamId] : [],
    playerIds: winner ? [winner.playerId] : [],
    attachment,
    tags: [definition.displayName, ...(team ? [team.abbreviation] : [])],
    unread: false,
  };
}

function runnerUpName(
  input: DetectorInput,
  award: AwardResult,
  subjectId: string,
): string | null {
  if (award.winner.subjectType === "coach") {
    const coach = input.state.world.coaches[subjectId];
    return coach ? `${coach.firstName} ${coach.lastName}` : null;
  }
  const player = input.refs.player(subjectId);
  return player ? `${player.firstName} ${player.lastName}` : null;
}
