import {
  FACILITY_CATEGORIES,
  type FacilityCategory,
} from "@/domain/entities/franchise-ops";
import type {
  FranchiseHistory,
  FranchiseSeasonRecord,
  PlayoffResultSnapshot,
} from "@/domain/entities/franchise-history";
import type { DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { analyzePlayoffBracket } from "@/state/playoff-conference-view";
import { calculateFranchiseValue } from "@/state/franchise-value";
import { getTeamPayroll } from "@/systems/salary-cap";
import { getFinancialStatement } from "@/systems/team-finances";

export type AppendFranchiseSeasonRecordInput = {
  teamId: TeamId;
  playoffResult?: PlayoffResultSnapshot;
  championship?: boolean;
  relocated?: boolean;
  notableEventIds?: string[];
};

function facilityLevelsSnapshot(
  state: GameState,
  teamId: TeamId,
): Record<FacilityCategory, number> {
  const ops = state.business.franchiseOps[teamId];
  const levels = {} as Record<FacilityCategory, number>;
  for (const category of FACILITY_CATEGORIES) {
    levels[category] = ops?.facilities[category].level ?? 1;
  }
  return levels;
}

function leagueRankForTeam(state: GameState, teamId: TeamId): number | null {
  const standings = Object.values(state.competition.standings.byTeamId);
  if (standings.length === 0) {
    return null;
  }
  const sorted = [...standings].sort((a, b) => {
    if (b.winPercentage !== a.winPercentage) {
      return b.winPercentage - a.winPercentage;
    }
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    return a.teamId.localeCompare(b.teamId);
  });
  const index = sorted.findIndex((row) => row.teamId === teamId);
  return index < 0 ? null : index + 1;
}

/**
 * Appends a season-end snapshot to franchise history for one team.
 */
export function appendFranchiseSeasonRecord(
  state: GameState,
  input: AppendFranchiseSeasonRecordInput,
): SystemResult {
  const { teamId } = input;
  const team = state.world.teams[teamId];
  const ops = state.business.franchiseOps[teamId];
  if (!team || !ops) {
    throw new Error(`appendFranchiseSeasonRecord: team "${teamId}" missing.`);
  }

  const season = state.competition.season;
  const standing = state.competition.standings.byTeamId[teamId];
  const year = season.year;
  const statement = getFinancialStatement(state, teamId, year);
  const finances = state.business.finances[teamId];

  const relocatedThisSeason =
    input.relocated ??
    (() => {
      const process = state.business.relocationByTeamId[teamId];
      return (
        process?.stage === "complete" &&
        process.lastCompletedRelocationSeasonYear === year
      );
    })();

  const record: FranchiseSeasonRecord = {
    seasonId: season.id,
    seasonYear: year,
    wins: standing?.wins ?? 0,
    losses: standing?.losses ?? 0,
    playoffResult: input.playoffResult ?? "missed",
    championship: input.championship ?? false,
    revenue: statement.revenue.total,
    expenses: statement.expenses.total,
    netIncome: statement.netIncome,
    payroll: getTeamPayroll(teamId, year, state),
    leagueRank: leagueRankForTeam(state, teamId),
    attendance: finances?.attendanceByYear[String(year)] ?? null,
    businessFunds: finances?.businessFunds ?? 0,
    fanSentiment: ops.fanSentiment,
    reputation: team.reputation,
    facilityLevels: facilityLevelsSnapshot(state, teamId),
    relocated: relocatedThisSeason,
    city: team.city,
    name: team.name,
    notableEventIds: input.notableEventIds ?? [],
    franchiseValue: calculateFranchiseValue(state, teamId),
  };

  const existing: FranchiseHistory = state.business.franchiseHistory[
    teamId
  ] ?? {
    teamId,
    seasons: [],
  };

  return systemResult({
    ...state,
    business: {
      ...state.business,
      franchiseHistory: {
        ...state.business.franchiseHistory,
        [teamId]: {
          teamId,
          seasons: [...existing.seasons, record],
        },
      },
    },
  });
}

/**
 * Append season records for every team at season finalization.
 * Idempotent for the current seasonId (skips teams that already have it).
 */
export function appendAllFranchiseSeasonRecords(
  state: GameState,
): SystemResult {
  let current = state;
  const events: DomainEvent[] = [];
  const championId = state.competition.playoffs.championTeamId ?? null;
  const playoffResultByTeam = derivePlayoffResults(state);

  for (const teamId of Object.keys(current.world.teams).sort() as TeamId[]) {
    const history = current.business.franchiseHistory[teamId];
    const already =
      history?.seasons.some(
        (s) => s.seasonId === current.competition.season.id,
      ) ?? false;
    if (already) {
      continue;
    }
    const result = appendFranchiseSeasonRecord(current, {
      teamId,
      playoffResult: playoffResultByTeam[teamId] ?? "missed",
      championship: championId === teamId,
    });
    current = result.state;
    events.push(...result.events);
  }
  return systemResult(current, events);
}

const PLAYOFF_RESULT_DEPTH: Record<PlayoffResultSnapshot, number> = {
  missed: 0,
  first_round: 1,
  second_round: 2,
  conference_finals: 3,
  finals: 4,
  champion: 5,
};

/**
 * Maps the round a team was eliminated in to a history snapshot by counting
 * back from the final round (`finalRound` = highest round index).
 *
 * - Final loss -> finals.
 * - `crossConferenceRounds` (conference brackets only: 1 with two
 *   conferences, 2 with four) are the rounds after the conference
 *   champions are decided. With four conferences the semifinal loss is
 *   recorded as conference_finals: that team won its conference but never
 *   reached the Finals, and no deeper snapshot below finals exists.
 * - League-wide brackets treat the semifinal as the conference finals.
 * - Within a conference: the conference finals, then second_round for the
 *   round before it; opening-round losses are always first_round.
 */
export function eliminationSnapshotForRound(
  round: number,
  finalRound: number,
  crossConferenceRounds = 0,
): PlayoffResultSnapshot {
  const fromFinal = finalRound - round;
  if (fromFinal <= 0) {
    return "finals";
  }
  const openingRound = round === 0 ? "first_round" : "second_round";
  if (crossConferenceRounds > 0) {
    if (fromFinal <= crossConferenceRounds) {
      return "conference_finals";
    }
    return fromFinal === crossConferenceRounds + 1 && round > 0
      ? "second_round"
      : openingRound;
  }
  return fromFinal === 1 ? "conference_finals" : openingRound;
}

function seriesParticipantTeamIds(series: {
  higherSeedTeamId: TeamId | null;
  lowerSeedTeamId: TeamId | null;
  byeParticipant?: { teamId: TeamId };
}): TeamId[] {
  const ids: TeamId[] = [];
  if (series.higherSeedTeamId) {
    ids.push(series.higherSeedTeamId);
  }
  if (series.lowerSeedTeamId) {
    ids.push(series.lowerSeedTeamId);
  }
  if (series.byeParticipant?.teamId) {
    ids.push(series.byeParticipant.teamId);
  }
  return [...new Set(ids)];
}

function upgradePlayoffResult(
  results: Record<string, PlayoffResultSnapshot>,
  teamId: TeamId,
  next: PlayoffResultSnapshot,
): void {
  const current = results[teamId] ?? "missed";
  if (PLAYOFF_RESULT_DEPTH[next] > PLAYOFF_RESULT_DEPTH[current]) {
    results[teamId] = next;
  }
}

/**
 * Derives per-team playoff depth from completed series.
 * Qualifiers default to first_round; losers are upgraded by elimination
 * round; champion overrides. Exported for tests.
 */
export function derivePlayoffResults(
  state: GameState,
): Record<string, PlayoffResultSnapshot> {
  const results: Record<string, PlayoffResultSnapshot> = {};
  const playoffs = state.competition.playoffs;
  const bracket = analyzePlayoffBracket(playoffs, state);
  const crossRounds = bracket.isConferenceBracket
    ? bracket.crossConferenceRounds
    : 0;
  // Power-of-two league-wide fields have a known final even when the series
  // list is partial; other shapes (6/12 teams, conference brackets) carry the
  // full series list, so the highest round is the final.
  const fieldSize = playoffs.fieldSize;
  const finalRound =
    !bracket.isConferenceBracket &&
    fieldSize >= 2 &&
    (fieldSize & (fieldSize - 1)) === 0
      ? Math.log2(fieldSize) - 1
      : bracket.finalRound;

  for (const seed of playoffs.qualifiedTeams) {
    results[seed.teamId] = "first_round";
  }

  for (const series of playoffs.series) {
    if (series.status !== "complete" || series.winnerTeamId === undefined) {
      continue;
    }
    const loserResult = eliminationSnapshotForRound(
      series.round,
      finalRound,
      crossRounds,
    );
    for (const teamId of seriesParticipantTeamIds(series)) {
      if (teamId === series.winnerTeamId) {
        continue;
      }
      upgradePlayoffResult(results, teamId, loserResult);
    }
  }

  if (playoffs.championTeamId) {
    results[playoffs.championTeamId] = "champion";
  }
  return results;
}
