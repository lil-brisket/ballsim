/**
 * Legacy: Hall of Fame inductions and retired jersey numbers.
 *
 * Hall of Fame: a retired player becomes eligible
 * {@link HALL_OF_FAME_WAIT_SEASONS} seasons after his last one, with at least
 * {@link HALL_OF_FAME_MIN_SEASONS} seasons played. His career value is
 * seasons × (ppg + rpg / 2 + apg × 0.7) / 2 plus award and title points; at
 * {@link HALL_OF_FAME_SCORE} or more he is inducted when a new season starts.
 * Deterministic; no RNG.
 *
 * Retired numbers: an owner may retire the number of a retired player who
 * spent {@link RETIRE_NUMBER_MIN_SEASONS}+ seasons with the franchise. The
 * franchise never issues that number again (see jersey-numbers).
 */

import type { HallOfFameInductee } from "@/domain/entities/legacy";
import type { PlayerSeasonStatLine } from "@/domain/entities/player-history";
import type { CareerBasis } from "@/domain/entities/retired-player";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { PlayerId, TeamId } from "@/domain/ids";
import { isJerseyNumber } from "@/domain/jersey-number";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";

export const HALL_OF_FAME_WAIT_SEASONS = 3;
export const HALL_OF_FAME_MIN_SEASONS = 6;
export const HALL_OF_FAME_SCORE = 120;
export const RETIRE_NUMBER_MIN_SEASONS = 3;

const AWARD_POINTS: Record<string, number> = {
  mvp: 30,
  dpoy: 15,
  roy: 5,
  sixth_man: 5,
  most_improved: 3,
};
const TITLE_POINTS = 8;

export type CareerSummary = {
  playerId: PlayerId;
  seasons: number;
  lastSeasonYear: number | null;
  totals: PlayerSeasonStatLine;
  awards: Record<string, number>;
  titles: number;
  /** Team with the most seasons (ties: the latest). */
  primaryTeamId: TeamId | null;
  seasonsByTeam: Record<string, number>;
  score: number;
};

const ZERO_LINE: PlayerSeasonStatLine = {
  games: 0,
  minutes: 0,
  points: 0,
  rebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fgMade: 0,
  fgAttempted: 0,
  threeMade: 0,
  threeAttempted: 0,
  ftMade: 0,
  ftAttempted: 0,
};

/** Career basis from a player's season records (empty without any). */
export function careerBasisFromHistory(
  state: GameState,
  playerId: PlayerId,
): CareerBasis {
  const seasons = state.business.playerHistory[playerId]?.seasons ?? [];
  const totals = { ...ZERO_LINE };
  const teamSeasons: CareerBasis["teamSeasons"] = [];
  let lastSeasonYear: number | null = null;
  for (const season of seasons) {
    const line = season.competition.regular;
    for (const key of Object.keys(totals) as (keyof PlayerSeasonStatLine)[]) {
      totals[key] += line[key];
    }
    lastSeasonYear = Math.max(
      lastSeasonYear ?? season.seasonYear,
      season.seasonYear,
    );
    const teamId = season.contractSnapshot.teamId;
    if (teamId) {
      teamSeasons.push({ seasonYear: season.seasonYear, teamId });
    }
  }
  return { seasons: seasons.length, lastSeasonYear, totals, teamSeasons };
}

/**
 * Season records while the player's history is in the save, else the
 * archived basis of a retired player whose history has left it.
 */
function careerBasis(state: GameState, playerId: PlayerId): CareerBasis {
  if (state.business.playerHistory[playerId] === undefined) {
    const archived = state.world.retiredPlayers[playerId];
    if (archived) return archived.career;
  }
  return careerBasisFromHistory(state, playerId);
}

/** Career totals, awards, titles and Hall of Fame score from history. */
export function careerSummary(
  state: GameState,
  playerId: PlayerId,
): CareerSummary {
  const { seasons, lastSeasonYear, totals, teamSeasons } = careerBasis(
    state,
    playerId,
  );
  const seasonsByTeam: Record<string, number> = {};
  let titles = 0;
  let primaryTeamId: TeamId | null = null;
  for (const { seasonYear, teamId } of teamSeasons) {
    seasonsByTeam[teamId] = (seasonsByTeam[teamId] ?? 0) + 1;
    const record = state.business.franchiseHistory[teamId]?.seasons.find(
      (s) => s.seasonYear === seasonYear,
    );
    if (record?.championship) titles += 1;
    if (
      primaryTeamId === null ||
      seasonsByTeam[teamId]! >= seasonsByTeam[primaryTeamId]!
    ) {
      primaryTeamId = teamId;
    }
  }
  const awards: Record<string, number> = {};
  for (const result of Object.values(state.business.awards.results)) {
    if (result.cadence !== "yearly" || result.winner.subjectId !== playerId) {
      continue;
    }
    awards[result.awardId] = (awards[result.awardId] ?? 0) + 1;
  }
  const games = Math.max(1, totals.games);
  const perGame =
    totals.points / games +
    totals.rebounds / games / 2 +
    (totals.assists / games) * 0.7;
  const awardPoints = Object.entries(awards).reduce(
    (sum, [id, count]) => sum + (AWARD_POINTS[id] ?? 0) * count,
    0,
  );
  const score = Math.round(
    (seasons * perGame) / 2 + awardPoints + titles * TITLE_POINTS,
  );
  return {
    playerId,
    seasons,
    lastSeasonYear,
    totals: { ...totals },
    awards,
    titles,
    primaryTeamId,
    seasonsByTeam,
    score,
  };
}

/**
 * Induct everyone newly eligible for the season that is starting.
 * Idempotent (inductees are never inducted twice).
 */
export function processHallOfFameInductions(state: GameState): SystemResult {
  const year = state.competition.season.year;
  const already = new Set(
    (state.business.hallOfFame?.inductees ?? []).map((i) => i.playerId),
  );
  const inducted: HallOfFameInductee[] = [];
  const events: DomainEvent[] = [];
  // Retired players' archive records outlive their full rows (save-history.ts).
  for (const player of Object.values(state.world.retiredPlayers).sort((a, b) =>
    a.id < b.id ? -1 : 1,
  )) {
    if (already.has(player.id)) continue;
    const career = careerSummary(state, player.id);
    if (
      career.lastSeasonYear === null ||
      career.seasons < HALL_OF_FAME_MIN_SEASONS ||
      year - career.lastSeasonYear < HALL_OF_FAME_WAIT_SEASONS ||
      career.score < HALL_OF_FAME_SCORE
    ) {
      continue;
    }
    const inductee: HallOfFameInductee = {
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      inductedSeasonYear: year,
      lastSeasonYear: career.lastSeasonYear,
      primaryTeamId: career.primaryTeamId,
      seasons: career.seasons,
      score: career.score,
      summary: careerLine(career),
    };
    inducted.push(inductee);
    events.push(
      createDomainEvent({
        type: "HallOfFameInducted",
        occurredOn: state.world.calendar.currentDate,
        payload: {
          playerId: player.id,
          teamId: career.primaryTeamId,
          seasonYear: year,
          summary: inductee.summary,
        },
      }),
    );
  }
  if (inducted.length === 0) return systemResult(state);
  return systemResult(
    {
      ...state,
      business: {
        ...state.business,
        hallOfFame: {
          inductees: [
            ...(state.business.hallOfFame?.inductees ?? []),
            ...inducted,
          ],
        },
      },
    },
    events,
  );
}

export function careerLine(career: CareerSummary): string {
  const parts: string[] = [];
  if (career.awards.mvp) parts.push(`${career.awards.mvp}× MVP`);
  if (career.awards.dpoy) parts.push(`${career.awards.dpoy}× DPOY`);
  if (career.titles > 0) {
    parts.push(`${career.titles} title${career.titles === 1 ? "" : "s"}`);
  }
  const games = Math.max(1, career.totals.games);
  parts.push(`${(career.totals.points / games).toFixed(1)} ppg`);
  parts.push(`${career.seasons} seasons`);
  return parts.join(" · ");
}

/** Why the owner cannot retire this player's number, or null. */
export function getRetireNumberBlockReason(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): string | null {
  const player = state.world.retiredPlayers[playerId];
  if (!player) {
    return state.world.players[playerId]
      ? "Numbers are retired once a player's career is over."
      : "Player not found.";
  }
  const career = careerSummary(state, playerId);
  if ((career.seasonsByTeam[teamId] ?? 0) < RETIRE_NUMBER_MIN_SEASONS) {
    return `He needs ${RETIRE_NUMBER_MIN_SEASONS} seasons with your franchise.`;
  }
  if (!isJerseyNumber(player.jerseyNumber))
    return "He has no number to retire.";
  const retired = state.world.retiredNumbers?.[teamId] ?? [];
  if (retired.some((r) => r.number === player.jerseyNumber)) {
    return `No. ${player.jerseyNumber} is already retired.`;
  }
  if (retired.some((r) => r.playerId === playerId)) {
    return "His number is already retired.";
  }
  const wearer = Object.values(state.world.players).find(
    (p) =>
      p.teamId === teamId &&
      p.retired !== true &&
      p.jerseyNumber === player.jerseyNumber,
  );
  if (wearer) {
    return `No. ${player.jerseyNumber} is worn by ${wearer.firstName} ${wearer.lastName} today.`;
  }
  return null;
}

/** Retire a franchise legend's number. Callers check the block reason. */
export function retireJerseyNumber(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): SystemResult {
  const blocked = getRetireNumberBlockReason(state, playerId, teamId);
  if (blocked) throw new Error(blocked);
  const player = state.world.retiredPlayers[playerId]!;
  const entry = {
    number: player.jerseyNumber,
    playerId,
    playerName: `${player.firstName} ${player.lastName}`,
    retiredOn: state.world.calendar.currentDate,
  };
  const retired = state.world.retiredNumbers ?? {};
  const event = createDomainEvent({
    type: "JerseyNumberRetired",
    occurredOn: state.world.calendar.currentDate,
    payload: { playerId, teamId, number: player.jerseyNumber },
  });
  return systemResult(
    {
      ...state,
      world: {
        ...state.world,
        retiredNumbers: {
          ...retired,
          [teamId]: [...(retired[teamId] ?? []), entry].sort(
            (a, b) => a.number - b.number,
          ),
        },
      },
    },
    [event],
  );
}
