import {
  type TeamBrandingView,
  toBrandingView,
} from "@/state/team-branding-view";
import type { GameState } from "@/state/game-state";
import { aggregateTeamStats } from "@/domain/entities/game-result";
import type { Game } from "@/domain/entities/game";
import { deriveDefaultTeamBranding } from "@/systems/team-branding-generation";

export type BoxScoreTeamStatsView = {
  points: number;
  fieldGoals: string;
  threePointers: string;
  freeThrows: string;
  rebounds: number;
  assists: number;
  turnovers: number;
  fouls: number;
};

export type PlayerBoxScoreRowView = {
  playerId: string;
  playerName: string;
  minutes: number;
  points: number;
  fieldGoals: string;
  threePointers: string;
  freeThrows: string;
  rebounds: number;
  assists: number;
  turnovers: number;
  fouls: number;
};

export type BoxScoreSideView = {
  teamId: string;
  city: string;
  name: string;
  abbreviation: string;
  score: number;
  teamStats: BoxScoreTeamStatsView;
  players: PlayerBoxScoreRowView[];
  branding: TeamBrandingView | null;
};

export type GameBoxScoreView = {
  gameId: string;
  date: string;
  competitionTypeLabel: string;
  seasonGameNumber: number | null;
  home: BoxScoreSideView;
  away: BoxScoreSideView;
  winner: "home" | "away";
  winnerName: string;
  margin: number;
  isCurrentSeason: boolean;
  /** Points per period (quarters, then overtimes), for the scoreboard table. */
  periods: Array<{ home: number; away: number }>;
  rotation: GameRotationPanelView | null;
};

export type GameRotationPlayerCompareView = {
  playerId: string;
  name: string;
  minutes: number;
  targetMinutes: number | null;
  explanations: string[];
};

export type GameRotationSubView = {
  clockLabel: string;
  teamAbbreviation: string;
  detail: string;
};

export type GameRotationPanelView = {
  homePlayers: GameRotationPlayerCompareView[];
  awayPlayers: GameRotationPlayerCompareView[];
  substitutions: GameRotationSubView[];
};

/** True when a finalized current-season game can open a box-score page. */
export function canOpenGameBoxScore(state: GameState, gameId: string): boolean {
  const game = state.competition.games[gameId];
  if (!game || game.status !== "final") {
    return false;
  }
  return game.seasonId === state.competition.season.id;
}

/**
 * Current-season finalized game box score.
 * Returns null when missing, not final, or not current season.
 */
export function toGameBoxScoreView(
  state: GameState,
  gameId: string,
): GameBoxScoreView | null {
  const game = state.competition.games[gameId];
  if (!game || game.status !== "final") {
    return null;
  }
  if (game.seasonId !== state.competition.season.id) {
    return null;
  }

  const homeTeamLive = state.world.teams[game.homeTeamId];
  const awayTeamLive = state.world.teams[game.awayTeamId];
  const homeIdentity = resolveTeamIdentity(
    game.homeTeamSnapshot,
    homeTeamLive,
    game.homeTeamId,
  );
  const awayIdentity = resolveTeamIdentity(
    game.awayTeamSnapshot,
    awayTeamLive,
    game.awayTeamId,
  );

  const { homeRows, awayRows } = partitionBoxScorePlayers(game);

  const homeTeamStats = aggregateTeamStats(game.homeTeamId, homeRows);
  const awayTeamStats = aggregateTeamStats(game.awayTeamId, awayRows);

  const winner: "home" | "away" =
    game.score.home > game.score.away ? "home" : "away";
  const margin = Math.abs(game.score.home - game.score.away);
  const winnerName =
    winner === "home"
      ? `${homeIdentity.city} ${homeIdentity.name}`
      : `${awayIdentity.city} ${awayIdentity.name}`;

  let seasonGameNumber: number | null = null;
  if (game.competitionType === "regular_season") {
    let regularIndex = 0;
    for (const gameId of state.competition.schedule.gameIds) {
      const scheduled = state.competition.games[gameId];
      if (scheduled?.competitionType !== "regular_season") {
        continue;
      }
      regularIndex += 1;
      if (scheduled.id === game.id) {
        seasonGameNumber = regularIndex;
        break;
      }
    }
  }

  return {
    gameId: game.id,
    date: game.date,
    competitionTypeLabel:
      game.competitionType === "playoffs"
        ? "Playoffs"
        : game.competitionType === "preseason"
          ? "Preseason"
          : "Regular Season",
    seasonGameNumber,
    home: {
      teamId: homeIdentity.teamId,
      city: homeIdentity.city,
      name: homeIdentity.name,
      abbreviation: homeIdentity.abbreviation,
      branding: homeIdentity.branding,
      score: game.score.home,
      teamStats: toTeamStatsView(homeTeamStats),
      players: homeRows.map((row) => toPlayerBoxScoreRow(state, row)),
    },
    away: {
      teamId: awayIdentity.teamId,
      city: awayIdentity.city,
      name: awayIdentity.name,
      abbreviation: awayIdentity.abbreviation,
      branding: awayIdentity.branding,
      score: game.score.away,
      teamStats: toTeamStatsView(awayTeamStats),
      players: awayRows.map((row) => toPlayerBoxScoreRow(state, row)),
    },
    winner,
    winnerName,
    margin,
    isCurrentSeason: true,
    periods: game.periodScores.map((period) => ({
      home: period.home,
      away: period.away,
    })),
    rotation: toRotationPanelView(
      game,
      homeIdentity.abbreviation,
      awayIdentity.abbreviation,
      state,
    ),
  };
}

function toRotationPanelView(
  game: Game,
  homeAbbr: string,
  awayAbbr: string,
  state: GameState,
): GameRotationPanelView | null {
  const meta = game.rotationMeta;
  if (meta == null) {
    return null;
  }
  const buildSide = (
    snapshot: typeof meta.home,
    rows: typeof game.playerStats,
  ): GameRotationPlayerCompareView[] => {
    const byId = new Map(snapshot.map((entry) => [entry.playerId, entry]));
    return rows
      .filter((row) => row.minutes > 0 || byId.has(row.playerId))
      .map((row) => {
        const snap = byId.get(row.playerId);
        const player = state.world.players[row.playerId];
        const name =
          row.firstName && row.lastName
            ? `${row.firstName} ${row.lastName}`
            : player
              ? `${player.firstName} ${player.lastName}`
              : row.playerId;
        return {
          playerId: row.playerId,
          name,
          minutes: row.minutes,
          targetMinutes: snap?.targetMinutes ?? null,
          explanations: meta.explanations[row.playerId] ?? [],
        };
      })
      .sort((a, b) => b.minutes - a.minutes);
  };

  const { homeRows, awayRows } = partitionBoxScorePlayers(game);
  const substitutions = meta.trace
    .filter((entry) => entry.playerInId != null)
    .slice(0, 40)
    .map((entry) => {
      const minutes = Math.floor(entry.secondsRemaining / 60);
      const seconds = Math.floor(entry.secondsRemaining % 60);
      const periodLabel =
        entry.periodNumber <= 4
          ? `Q${entry.periodNumber}`
          : `OT${entry.periodNumber - 4}`;
      const abbr = entry.teamId === game.homeTeamId ? homeAbbr : awayAbbr;
      return {
        clockLabel: `${minutes}:${seconds.toString().padStart(2, "0")} ${periodLabel}`,
        teamAbbreviation: abbr,
        detail:
          entry.playerOutId != null
            ? `OUT ${entry.playerOutId} → IN ${entry.playerInId} (${entry.reason})`
            : `IN ${entry.playerInId} (${entry.reason})`,
      };
    });

  return {
    homePlayers: buildSide(meta.home, homeRows),
    awayPlayers: buildSide(meta.away, awayRows),
    substitutions,
  };
}

export function resolveTeamIdentity(
  snapshot: Game["homeTeamSnapshot"],
  live: GameState["world"]["teams"][string] | undefined,
  teamId: string,
): {
  teamId: string;
  city: string;
  name: string;
  abbreviation: string;
  branding: TeamBrandingView | null;
} {
  if (snapshot) {
    // Snapshot is authoritative for historical games — never substitute live branding.
    const fromSnapshot = toBrandingView(snapshot.branding);
    return {
      teamId: snapshot.teamId,
      city: snapshot.city,
      name: snapshot.name,
      abbreviation: snapshot.abbreviation,
      branding:
        fromSnapshot ??
        toBrandingView(
          deriveDefaultTeamBranding(
            snapshot.teamId,
            snapshot.city,
            snapshot.name,
          ),
        ),
    };
  }
  const fromLive = toBrandingView(live?.branding);
  return {
    teamId,
    city: live?.city ?? "Unknown",
    name: live?.name ?? "Team",
    abbreviation: live?.abbreviation ?? "???",
    branding:
      fromLive ??
      toBrandingView(
        deriveDefaultTeamBranding(teamId, live?.city ?? "", live?.name ?? ""),
      ),
  };
}

function partitionBoxScorePlayers(game: Game): {
  homeRows: Game["playerStats"];
  awayRows: Game["playerStats"];
} {
  const withTeam = game.playerStats.filter((row) => row.teamId != null);
  if (withTeam.length === game.playerStats.length && withTeam.length > 0) {
    return {
      homeRows: game.playerStats.filter(
        (row) => row.teamId === game.homeTeamId,
      ),
      awayRows: game.playerStats.filter(
        (row) => row.teamId === game.awayTeamId,
      ),
    };
  }
  // Legacy pre-v35: home-then-away array order is a display hint only.
  const midpoint = Math.ceil(game.playerStats.length / 2);
  return {
    homeRows: game.playerStats.slice(0, midpoint),
    awayRows: game.playerStats.slice(midpoint),
  };
}

function toTeamStatsView(stats: {
  points: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  rebounds: number;
  assists: number;
  turnovers: number;
  fouls: number;
}): BoxScoreTeamStatsView {
  return {
    points: stats.points,
    fieldGoals: `${stats.fieldGoalsMade}/${stats.fieldGoalsAttempted}`,
    threePointers: `${stats.threePointersMade}/${stats.threePointersAttempted}`,
    freeThrows: `${stats.freeThrowsMade}/${stats.freeThrowsAttempted}`,
    rebounds: stats.rebounds,
    assists: stats.assists,
    turnovers: stats.turnovers,
    fouls: stats.fouls,
  };
}

function toPlayerBoxScoreRow(
  state: GameState,
  row: Game["playerStats"][number],
): PlayerBoxScoreRowView {
  let playerName: string;
  if (row.firstName != null && row.lastName != null) {
    playerName = `${row.firstName} ${row.lastName}`;
  } else {
    const live = state.world.players[row.playerId];
    playerName = live ? `${live.firstName} ${live.lastName}` : row.playerId;
  }
  return {
    playerId: row.playerId,
    playerName,
    minutes: row.minutes,
    points: row.points,
    fieldGoals: `${row.fieldGoalsMade}/${row.fieldGoalsAttempted}`,
    threePointers: `${row.threePointersMade}/${row.threePointersAttempted}`,
    freeThrows: `${row.freeThrowsMade}/${row.freeThrowsAttempted}`,
    rebounds: row.rebounds,
    assists: row.assists,
    turnovers: row.turnovers,
    fouls: row.fouls,
  };
}
