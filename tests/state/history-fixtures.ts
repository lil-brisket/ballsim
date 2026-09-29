import {
  buildAwardResultId,
  type AwardDefinitionId,
  type AwardResult,
} from "@/domain/entities/awards";
import type {
  FranchiseSeasonRecord,
  PlayoffResultSnapshot,
} from "@/domain/entities/franchise-history";
import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import {
  createEmptyPlayerSeasonStatLine,
  type PlayerSeasonRecord,
} from "@/domain/entities/player-history";
import {
  asLeagueId,
  asPlayerId,
  asSeasonId,
  asTeamId,
  type TeamId,
} from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { AWARD_DEFINITIONS } from "@/systems/awards/award-definitions";

function facilityLevels(): Record<FacilityCategory, number> {
  const levels = {} as Record<FacilityCategory, number>;
  for (const category of FACILITY_CATEGORIES) {
    levels[category as FacilityCategory] = 1;
  }
  return levels;
}

export function seasonRecord(input: {
  year: number;
  wins?: number;
  losses?: number;
  playoffResult?: PlayoffResultSnapshot;
  championship?: boolean;
  city?: string;
  name?: string;
  relocated?: boolean;
}): FranchiseSeasonRecord {
  const playoffResult = input.playoffResult ?? "missed";
  return {
    seasonId: asSeasonId(`season_${input.year}`),
    seasonYear: input.year,
    wins: input.wins ?? 41,
    losses: input.losses ?? 41,
    playoffResult,
    championship: input.championship ?? playoffResult === "champion",
    revenue: 100,
    expenses: 90,
    netIncome: 10,
    payroll: 80,
    leagueRank: null,
    attendance: null,
    businessFunds: 10,
    fanSentiment: 50,
    reputation: 50,
    facilityLevels: facilityLevels(),
    relocated: input.relocated ?? false,
    city: input.city ?? "City",
    name: input.name ?? "Team",
    notableEventIds: [],
    franchiseValue: 500_000_000,
  };
}

/** Replaces franchiseHistory entirely with the given team → seasons map. */
export function withFranchiseHistory(
  state: GameState,
  byTeam: Record<string, FranchiseSeasonRecord[]>,
): GameState {
  const franchiseHistory: GameState["business"]["franchiseHistory"] = {};
  for (const [teamId, seasons] of Object.entries(byTeam)) {
    franchiseHistory[teamId] = { teamId: asTeamId(teamId), seasons };
  }
  return { ...state, business: { ...state.business, franchiseHistory } };
}

export function teamIds(state: GameState): TeamId[] {
  return Object.keys(state.world.teams).sort() as TeamId[];
}

export function awardResult(input: {
  awardId: AwardDefinitionId;
  seasonYear: number;
  winnerId: string;
  teamId?: string | null;
  period?: string | null;
}): AwardResult {
  const def = AWARD_DEFINITIONS[input.awardId];
  const period =
    input.period !== undefined
      ? input.period
      : def.tier === "midseason"
        ? "midseason"
        : null;
  return {
    id: buildAwardResultId("league", input.seasonYear, period, input.awardId),
    awardId: input.awardId,
    cadence: def.cadence,
    leagueId: asLeagueId("league"),
    seasonId: asSeasonId(`season_${input.seasonYear}`),
    seasonYear: input.seasonYear,
    period,
    winner: {
      subjectType: def.subjectType,
      subjectId: asPlayerId(input.winnerId),
      teamId: input.teamId ? asTeamId(input.teamId) : null,
    },
    candidates: [],
    context: {
      winnerScore: 1,
      breakdown: {},
      statSnapshot: {
        games: 0,
        minutes: 0,
        totals: createEmptyPlayerSeasonStatLine(),
        perGame: {
          points: 0,
          rebounds: 0,
          assists: 0,
          steals: 0,
          blocks: 0,
          turnovers: 0,
          minutes: 0,
        },
        efficiency: { tsPct: null, eFgPct: null, astTo: null },
        teamRecord: { wins: 0, losses: 0, winPct: 0 },
        teamRank: null,
        scoringBreakdown: {},
        metricVersion: 1,
      },
      metricVersion: 1,
    },
  };
}

export function withAwards(
  state: GameState,
  results: AwardResult[],
): GameState {
  const byId: Record<string, AwardResult> = {};
  for (const result of results) byId[result.id] = result;
  return {
    ...state,
    business: { ...state.business, awards: { results: byId } },
  };
}

export function playerSeason(input: {
  year: number;
  teamId: string | null;
}): PlayerSeasonRecord {
  const line = createEmptyPlayerSeasonStatLine();
  return {
    seasonId: asSeasonId(`season_${input.year}`),
    seasonYear: input.year,
    age: 25,
    overall: 70,
    attributes: {} as PlayerSeasonRecord["attributes"],
    developmentStage: "prime" as PlayerSeasonRecord["developmentStage"],
    injuryKind: "available",
    contractSnapshot: {
      contractId: null,
      salary: null,
      teamId: input.teamId ? asTeamId(input.teamId) : null,
    },
    competition: {
      regular: line,
      playoffs: line,
      development: line,
      combined: line,
    },
  };
}

export function withPlayerHistory(
  state: GameState,
  byPlayer: Record<string, PlayerSeasonRecord[]>,
): GameState {
  const playerHistory: GameState["business"]["playerHistory"] = {
    ...state.business.playerHistory,
  };
  for (const [playerId, seasons] of Object.entries(byPlayer)) {
    playerHistory[playerId] = {
      playerId: asPlayerId(playerId),
      seasons,
      trackingStartedSeasonYear: seasons[0]?.seasonYear ?? null,
    };
  }
  return { ...state, business: { ...state.business, playerHistory } };
}
