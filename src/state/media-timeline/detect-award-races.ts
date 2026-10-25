import { addCalendarDays, parseCalendarDate } from "@/domain/calendar-date";
import type { AwardDefinitionId } from "@/domain/entities/awards";
import { getAwardDefinition } from "@/systems/awards/award-definitions";
import { evaluateAwardRace, type AwardRace } from "@/systems/awards/award-race";
import { TIMELINE_LIMITS } from "./build-league-timeline";
import type { DetectorInput } from "./detector-input";
import type {
  AwardRaceAttachment,
  AwardRaceContender,
  TimelinePost,
} from "./types";

/** Season awards that get a weekly race post. */
const RACE_AWARDS: readonly AwardDefinitionId[] = ["mvp", "dpoy", "roy"];

const RACE_NOTABILITY: Partial<Record<AwardDefinitionId, number>> = {
  mvp: 55,
};
const DEFAULT_RACE_NOTABILITY = 45;

function isSunday(date: string): boolean {
  const { year, month, day } = parseCalendarDate(date);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay() === 0;
}

/**
 * Sundays that close a regular-season week we can post about, newest
 * `awardRaceWeeks` only. Once the regular season is over the yearly awards
 * are decided, so the last week before the final game is the last race.
 */
function raceSundays(input: DetectorInput): string[] {
  const { state, ctx } = input;
  const currentDate = state.world.calendar.currentDate;
  const firstGame = ctx.games.find(
    (game) => game.competitionType === "regular_season",
  );
  if (!firstGame || ctx.lastRegularSeasonDate === null) return [];
  const seasonOver = state.competition.season.phase !== "regular";

  const sundays: string[] = [];
  let day = addCalendarDays(currentDate, -1);
  while (
    day >= firstGame.date &&
    sundays.length < TIMELINE_LIMITS.awardRaceWeeks
  ) {
    if (isSunday(day) && (!seasonOver || day <= ctx.lastRegularSeasonDate)) {
      sundays.push(day);
    }
    day = addCalendarDays(day, -1);
  }
  return sundays.reverse();
}

/**
 * Weekly award-race standings for the current season. Each race re-scores
 * the season, so only the latest weeks are posted and each (award, week) is
 * evaluated once per build.
 */
export function detectAwardRaces(input: DetectorInput): TimelinePost[] {
  const { state, ctx, refs } = input;
  const sundays = raceSundays(input);
  if (sundays.length === 0) return [];
  const firstGameDate = ctx.games.find(
    (game) => game.competitionType === "regular_season",
  )!.date;

  const cache = new Map<string, AwardRace | null>();
  const raceOn = (awardId: AwardDefinitionId, sunday: string) => {
    const key = `${awardId}|${sunday}`;
    if (!cache.has(key)) {
      cache.set(
        key,
        sunday < firstGameDate
          ? null
          : evaluateAwardRace(state, awardId, { throughDate: sunday }),
      );
    }
    return cache.get(key) ?? null;
  };

  const leaderName = (race: AwardRace | null) => {
    const leader = race?.contenders[0];
    return leader ? contenderName(input, leader.subjectId) : null;
  };

  const posts: TimelinePost[] = [];
  for (const sunday of sundays) {
    for (const awardId of RACE_AWARDS) {
      const race = raceOn(awardId, sunday);
      if (!race) continue;

      const contenders: AwardRaceContender[] = [];
      for (const candidate of race.contenders) {
        const player = refs.player(candidate.subjectId);
        if (!player) continue;
        contenders.push({
          rank: contenders.length + 1,
          player,
          coachName: null,
          team: candidate.teamId ? refs.team(candidate.teamId) : null,
        });
      }
      if (contenders.length === 0) continue;

      const previous = raceOn(awardId, addCalendarDays(sunday, -7));
      const previousLeader = previous?.contenders[0];
      const leader = race.contenders[0]!;
      const previousLeaderName =
        previousLeader && previousLeader.subjectId !== leader.subjectId
          ? leaderName(previous)
          : null;

      const definition = getAwardDefinition(awardId);
      const attachment: AwardRaceAttachment = {
        type: "award_race",
        awardId,
        awardName: definition.displayName,
        seasonYear: ctx.seasonYear,
        throughDate: sunday,
        contenders,
        previousLeaderName,
      };
      posts.push({
        id: `award-race:${ctx.seasonId}:${awardId}:${sunday}`,
        occurredOn: addCalendarDays(sunday, 1),
        kind: "award",
        importance: "medium",
        notability: RACE_NOTABILITY[awardId] ?? DEFAULT_RACE_NOTABILITY,
        relevance: 0,
        teamIds: [
          ...new Set(
            contenders.flatMap((c) => (c.team ? [c.team.teamId] : [])),
          ),
        ],
        playerIds: contenders.flatMap((c) =>
          c.player ? [c.player.playerId] : [],
        ),
        attachment,
        tags: [definition.displayName, "Award Race"],
        unread: false,
      });
    }
  }
  return posts;
}

function contenderName(input: DetectorInput, subjectId: string): string | null {
  const player = input.refs.player(subjectId);
  return player ? `${player.firstName} ${player.lastName}`.trim() : null;
}
