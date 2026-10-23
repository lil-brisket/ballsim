/**
 * Legacy views: the record book (single-game, season and career leaders,
 * league-wide and for the owner franchise), the Hall of Fame, franchise
 * legends whose numbers can be retired, and the retired numbers banner.
 * Presentation only; derived from the game archive and player history.
 */

import type { Game } from "@/domain/entities/game";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getActiveOwnerTeamId } from "@/state/owner-context";
import {
  careerSummary,
  getRetireNumberBlockReason,
  RETIRE_NUMBER_MIN_SEASONS,
} from "@/systems/legacy";

export type RecordStat = "points" | "rebounds" | "assists";

export const RECORD_STATS: readonly RecordStat[] = [
  "points",
  "rebounds",
  "assists",
];

export type RecordEntry = {
  playerId: string;
  playerName: string;
  teamId: string | null;
  value: number;
  /** "2027 season", "Oct 14, 2027 vs ABC", "9 seasons". */
  context: string;
};

export type RecordTable = {
  stat: RecordStat;
  single: RecordEntry[];
  season: RecordEntry[];
  career: RecordEntry[];
};

export type RecordBookView = {
  league: RecordTable[];
  franchise: RecordTable[];
  /** Owner franchise's best regular season, or null without history. */
  bestSeason: { seasonYear: number; wins: number; losses: number } | null;
  titles: number;
};

const TOP = 5;

function finalGames(state: GameState): Game[] {
  const games: Game[] = [];
  for (const game of Object.values(state.business.gameArchive)) {
    if (
      game.status === "final" &&
      game.competitionType !== "development_league"
    ) {
      games.push(game);
    }
  }
  for (const game of Object.values(state.competition.games)) {
    if (
      game.status === "final" &&
      game.competitionType !== "development_league" &&
      state.business.gameArchive[game.id] === undefined
    ) {
      games.push(game);
    }
  }
  return games;
}

function name(state: GameState, playerId: string, fallback?: string | null) {
  const p = state.world.players[playerId];
  return p ? `${p.firstName} ${p.lastName}` : (fallback ?? playerId);
}

function top(entries: RecordEntry[]): RecordEntry[] {
  return entries
    .sort((a, b) => b.value - a.value || (a.playerId < b.playerId ? -1 : 1))
    .slice(0, TOP);
}

function tables(
  state: GameState,
  games: Game[],
  teamId: TeamId | null,
): RecordTable[] {
  return RECORD_STATS.map((stat) => {
    const single: RecordEntry[] = [];
    for (const game of games) {
      for (const line of game.playerStats) {
        if (teamId && line.teamId !== teamId) continue;
        const opponent =
          line.teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
        single.push({
          playerId: line.playerId,
          playerName: name(
            state,
            line.playerId,
            line.firstName ? `${line.firstName} ${line.lastName}` : null,
          ),
          teamId: line.teamId,
          value: line[stat],
          context: `${game.date} vs ${state.world.teams[opponent]?.abbreviation ?? "—"}`,
        });
      }
    }
    const season: RecordEntry[] = [];
    const career: RecordEntry[] = [];
    for (const history of Object.values(state.business.playerHistory)) {
      let total = 0;
      let seasons = 0;
      for (const record of history.seasons) {
        const line = record.competition.regular;
        const seasonTeam = record.contractSnapshot.teamId;
        if (teamId && seasonTeam !== teamId) continue;
        total += line[stat];
        seasons += 1;
        if (line.games > 0) {
          season.push({
            playerId: history.playerId,
            playerName: name(state, history.playerId),
            teamId: seasonTeam,
            value: Math.round((line[stat] / line.games) * 10) / 10,
            context: `${record.seasonYear} season (per game)`,
          });
        }
      }
      if (seasons > 0) {
        career.push({
          playerId: history.playerId,
          playerName: name(state, history.playerId),
          teamId,
          value: total,
          context: `${seasons} season${seasons === 1 ? "" : "s"}`,
        });
      }
    }
    return {
      stat,
      single: top(single),
      season: top(season),
      career: top(career),
    };
  });
}

export function toRecordBookView(state: GameState): RecordBookView {
  const teamId = getActiveOwnerTeamId(state);
  const games = finalGames(state);
  const history = state.business.franchiseHistory[teamId]?.seasons ?? [];
  let best: RecordBookView["bestSeason"] = null;
  let titles = 0;
  for (const season of history) {
    if (season.championship) titles += 1;
    if (!best || season.wins > best.wins) {
      best = {
        seasonYear: season.seasonYear,
        wins: season.wins,
        losses: season.losses,
      };
    }
  }
  return {
    league: tables(state, games, null),
    franchise: tables(state, games, teamId),
    bestSeason: best,
    titles,
  };
}

export type FranchiseLegendRow = {
  playerId: string;
  playerName: string;
  number: number;
  seasonsWithTeam: number;
  summary: string;
  /** Why the number cannot be retired now; null when it can. */
  blockedReason: string | null;
};

export type LegacyView = {
  hallOfFame: {
    playerId: string;
    playerName: string;
    inductedSeasonYear: number;
    teamName: string | null;
    summary: string;
  }[];
  retiredNumbers: { number: number; playerName: string; playerId: string }[];
  /** Retired players with enough seasons on the owner team. */
  legends: FranchiseLegendRow[];
};

export function toLegacyView(state: GameState): LegacyView {
  const teamId = getActiveOwnerTeamId(state);
  const hallOfFame = [...(state.business.hallOfFame?.inductees ?? [])]
    .sort(
      (a, b) =>
        b.inductedSeasonYear - a.inductedSeasonYear ||
        a.playerName.localeCompare(b.playerName),
    )
    .map((inductee) => {
      const team = inductee.primaryTeamId
        ? state.world.teams[inductee.primaryTeamId]
        : undefined;
      return {
        playerId: inductee.playerId,
        playerName: inductee.playerName,
        inductedSeasonYear: inductee.inductedSeasonYear,
        teamName: team ? `${team.city} ${team.name}` : null,
        summary: inductee.summary,
      };
    });
  const retiredNumbers = (state.world.retiredNumbers?.[teamId] ?? []).map(
    (entry) => ({
      number: entry.number,
      playerName: entry.playerName,
      playerId: entry.playerId,
    }),
  );
  const legends: FranchiseLegendRow[] = [];
  for (const player of Object.values(state.world.players)) {
    if (player.retired !== true) continue;
    const career = careerSummary(state, player.id as PlayerId);
    const seasons = career.seasonsByTeam[teamId] ?? 0;
    if (seasons < RETIRE_NUMBER_MIN_SEASONS) continue;
    if (retiredNumbers.some((r) => r.playerId === player.id)) continue;
    legends.push({
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`,
      number: player.jerseyNumber,
      seasonsWithTeam: seasons,
      summary: `${career.seasons} seasons · ${(career.totals.points / Math.max(1, career.totals.games)).toFixed(1)} ppg`,
      blockedReason: getRetireNumberBlockReason(state, player.id, teamId),
    });
  }
  legends.sort(
    (a, b) =>
      b.seasonsWithTeam - a.seasonsWithTeam ||
      a.playerName.localeCompare(b.playerName),
  );
  return { hallOfFame, retiredNumbers, legends };
}
