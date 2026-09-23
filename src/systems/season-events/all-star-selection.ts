import type { DomainEvent } from "@/domain/events";
import { createDomainEvent } from "@/domain/events";
import type { Rng } from "@/domain/rng";
import { asGameId, asTeamId, type PlayerId, type TeamId } from "@/domain/ids";
import { createGame } from "@/domain/entities/game";
import type {
  AllStarEventState,
  AllStarSelection,
} from "@/domain/entities/season-events";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  ensureSeasonEventsState,
  withSeasonEvents,
} from "@/systems/season-events/plan-season-events";

export type AllStarSelectionRules = {
  startersPerCategory: number;
  reservesPerCategory: number;
  maxPerTeam: number;
};

export const DEFAULT_ALL_STAR_SELECTION_RULES: AllStarSelectionRules = {
  startersPerCategory: 2,
  reservesPerCategory: 2,
  maxPerTeam: 3,
};

/**
 * Apply selection rules to finalized fan-vote rankings.
 * Voting answers "who fans voted for"; this answers "who was selected."
 */
export function finalizeAllStarSelections(
  state: GameState,
  allStar: AllStarEventState,
  rules: AllStarSelectionRules = DEFAULT_ALL_STAR_SELECTION_RULES,
): { allStar: AllStarEventState } {
  const campaign = state.competition.seasonEvents.fanVoting[allStar.campaignId];
  if (!campaign) {
    return { allStar };
  }

  const selections: AllStarSelection[] = [];
  const teamCounts = new Map<string, number>();

  for (const categoryId of Object.keys(campaign.categories).sort()) {
    const category = campaign.categories[categoryId]!;
    const ranked = Object.values(category.candidates)
      .filter((c) => c.voteTotal > 0 || c.rank > 0)
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (b.voteTotal !== a.voteTotal) return b.voteTotal - a.voteTotal;
        return a.playerId.localeCompare(b.playerId);
      });

    let starters = 0;
    let reserves = 0;
    for (const candidate of ranked) {
      const teamId = candidate.teamId;
      const teamKey = teamId ?? "none";
      const teamCount = teamCounts.get(teamKey) ?? 0;
      if (teamId != null && teamCount >= rules.maxPerTeam) {
        continue;
      }

      if (starters < rules.startersPerCategory) {
        selections.push({
          playerId: candidate.playerId,
          teamId: candidate.teamId,
          conferenceId: category.conferenceId,
          role: "starter",
          voteRank: candidate.rank,
          categoryId,
        });
        starters += 1;
        if (teamId != null) teamCounts.set(teamKey, teamCount + 1);
      } else if (reserves < rules.reservesPerCategory) {
        selections.push({
          playerId: candidate.playerId,
          teamId: candidate.teamId,
          conferenceId: category.conferenceId,
          role: "reserve",
          voteRank: candidate.rank,
          categoryId,
        });
        reserves += 1;
        if (teamId != null) teamCounts.set(teamKey, teamCount + 1);
      }

      if (
        starters >= rules.startersPerCategory &&
        reserves >= rules.reservesPerCategory
      ) {
        break;
      }
    }
  }

  return {
    allStar: {
      ...allStar,
      selections,
    },
  };
}

/**
 * Exhibition All-Star game — competitionType all_star, outside schedule.gameIds.
 * Uses a lightweight deterministic score (not full possession sim) because
 * All-Star rosters mix players across franchise teamIds.
 */
export function simulateAllStarGameIfDue(
  state: GameState,
  rng: Rng,
  allStar: AllStarEventState,
): SystemResult {
  if (allStar.selections.length < 4) {
    return systemResult(
      withSeasonEvents(state, {
        ...ensureSeasonEventsState(state),
        allStar: { ...allStar, status: "completed" },
      }),
    );
  }

  const conferences = [
    ...new Set(
      allStar.selections
        .map((s) => s.conferenceId)
        .filter((id): id is string => id != null),
    ),
  ].sort();

  let homePlayers: PlayerId[];
  let awayPlayers: PlayerId[];

  if (conferences.length >= 2) {
    const homeLabel = conferences[0]!;
    const awayLabel = conferences[1]!;
    homePlayers = allStar.selections
      .filter((s) => s.conferenceId === homeLabel)
      .map((s) => s.playerId);
    awayPlayers = allStar.selections
      .filter((s) => s.conferenceId === awayLabel)
      .map((s) => s.playerId);
  } else {
    const sorted = [...allStar.selections].sort((a, b) =>
      a.playerId.localeCompare(b.playerId),
    );
    const mid = Math.ceil(sorted.length / 2);
    homePlayers = sorted.slice(0, mid).map((s) => s.playerId);
    awayPlayers = sorted.slice(mid).map((s) => s.playerId);
  }

  const homeTeamId = resolveShellTeamId(state, homePlayers, "home");
  const awayTeamId = resolveShellTeamId(state, awayPlayers, "away");
  if (homeTeamId == null || awayTeamId == null || homeTeamId === awayTeamId) {
    return systemResult(
      withSeasonEvents(state, {
        ...ensureSeasonEventsState(state),
        allStar: { ...allStar, status: "completed" },
      }),
    );
  }

  const gameId = asGameId(`allstar_${allStar.seasonId}`);
  if (state.competition.games[gameId]) {
    return systemResult(state);
  }

  const homeScore = 100 + Math.floor(rng.next() * 40);
  const awayScore = 100 + Math.floor(rng.next() * 40);
  // Avoid ties for a clean winner
  const finalHome =
    homeScore === awayScore ? homeScore + 1 : homeScore;

  const finalGame = createGame({
    id: gameId,
    seasonId: allStar.seasonId,
    date: allStar.eventDate,
    homeTeamId,
    awayTeamId,
    competitionType: "all_star",
    status: "final",
    score: { home: finalHome, away: awayScore },
    periodScores: [
      { home: Math.floor(finalHome / 2), away: Math.floor(awayScore / 2) },
      {
        home: finalHome - Math.floor(finalHome / 2),
        away: awayScore - Math.floor(awayScore / 2),
      },
    ],
    events: [],
    playerStats: [],
    homeTeamSnapshot: null,
    awayTeamSnapshot: null,
  });

  const event: DomainEvent = createDomainEvent({
    type: "GameCompleted",
    occurredOn: allStar.eventDate,
    payload: {
      gameId,
      homeTeamId,
      awayTeamId,
      homeScore: finalHome,
      awayScore,
      competitionType: "all_star",
    },
  });

  const current: GameState = {
    ...state,
    competition: {
      ...state.competition,
      games: {
        ...state.competition.games,
        [gameId]: finalGame,
      },
      seasonEvents: {
        ...ensureSeasonEventsState(state),
        allStar: {
          ...allStar,
          gameIds: [...allStar.gameIds, gameId],
          status: "completed",
        },
      },
    },
  };

  return systemResult(current, [event]);
}

function resolveShellTeamId(
  state: GameState,
  playerIds: readonly PlayerId[],
  side: "home" | "away",
): TeamId | null {
  for (const playerId of playerIds) {
    const player = state.world.players[playerId];
    if (player?.teamId) {
      return asTeamId(player.teamId);
    }
  }
  const teamIds = Object.keys(state.world.teams).sort();
  if (teamIds.length < 2) return null;
  return asTeamId(side === "home" ? teamIds[0]! : teamIds[1]!);
}
