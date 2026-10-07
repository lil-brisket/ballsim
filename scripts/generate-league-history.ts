/**
 * Deterministic 10-season league-history fixture generator.
 * Runs Standard (30/82/16) seasons via runLeagueCareer + createSeededRng,
 * snapshots live standings, completed playoff brackets, and award winners
 * at postseason, and writes tests/fixtures/league-history.json.
 *
 * Run:
 *   npx tsx scripts/generate-league-history.ts
 *   npx tsx scripts/generate-league-history.ts --seed 42 --seasons 10 --out tests/fixtures/league-history.json
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AwardResult } from "@/domain/entities/awards";
import type { PlayoffTournament } from "@/domain/entities/playoffs";
import type { TeamStanding } from "@/domain/entities/standings";
import { DEFAULT_GAME_SETTINGS } from "@/domain/game-settings";
import { runLeagueCareer } from "@/simulation/league-sanity/run-league-career";
import { listAwardResults } from "@/state/award-selectors";
import type { GameState } from "@/state/game-state";
import { compareStandings } from "@/systems/standings";

const DEFAULT_SEED = 42;
const DEFAULT_SEASONS = 10;
const DEFAULT_OUT = "tests/fixtures/league-history.json";
const FIDELITY = "box_score" as const;

export type LeagueHistoryTeam = {
  id: string;
  city: string;
  name: string;
  abbreviation: string;
};

export type LeagueHistorySeason = {
  seasonYear: number;
  seasonId: string;
  standings: TeamStanding[];
  playoffs: PlayoffTournament;
  awards: AwardResult[];
};

export type LeagueHistoryFixture = {
  meta: {
    seed: number;
    seasons: number;
    fidelity: typeof FIDELITY;
    skipOwnerGameplay: true;
    startingSeasonYear: number;
    teamCount: number;
    gamesPerTeam: number;
    playoffTeams: number;
    seriesLength: number;
  };
  teams: LeagueHistoryTeam[];
  seasons: LeagueHistorySeason[];
};

function parseArgs(argv: string[]): {
  seed: number;
  seasons: number;
  out: string;
} {
  let seed = DEFAULT_SEED;
  let seasons = DEFAULT_SEASONS;
  let out = DEFAULT_OUT;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = argv[i + 1];
    if (arg === "--seed" && next) {
      seed = Number(next);
      i += 1;
    } else if (arg === "--seasons" && next) {
      seasons = Number(next);
      i += 1;
    } else if (arg === "--out" && next) {
      out = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npx tsx scripts/generate-league-history.ts [--seed N] [--seasons N] [--out path]",
      );
      process.exit(0);
    }
  }

  if (!Number.isInteger(seed)) {
    throw new Error("--seed must be an integer");
  }
  if (!Number.isInteger(seasons) || seasons < 1) {
    throw new Error("--seasons must be an integer >= 1");
  }

  return { seed, seasons, out };
}

function snapshotTeams(state: GameState): LeagueHistoryTeam[] {
  return Object.values(state.world.teams)
    .map((team) => ({
      id: team.id,
      city: team.city,
      name: team.name,
      abbreviation: team.abbreviation,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function snapshotSeason(state: GameState): LeagueHistorySeason {
  const season = state.competition.season;
  const playoffs = state.competition.playoffs;
  if (playoffs.status !== "complete" || playoffs.championTeamId == null) {
    throw new Error(
      `Season ${season.year} playoffs are not complete (status=${playoffs.status}, phase=${season.phase}).`,
    );
  }

  const standings = Object.values(state.competition.standings.byTeamId).sort(
    compareStandings,
  );
  const expectedTeams = Object.keys(state.world.teams).length;
  if (standings.length !== expectedTeams) {
    throw new Error(
      `Season ${season.year} standings has ${standings.length} rows; expected ${expectedTeams}.`,
    );
  }

  return {
    seasonYear: season.year,
    seasonId: season.id,
    standings,
    playoffs,
    awards: listAwardResults(state, { seasonYear: season.year }),
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const settings = DEFAULT_GAME_SETTINGS;
  const outPath = resolve(args.out);

  console.error(
    `League history: seasons=${args.seasons} seed=${args.seed} fidelity=${FIDELITY} out=${outPath}`,
  );

  const seasons: LeagueHistorySeason[] = [];
  let teams: LeagueHistoryTeam[] = [];

  const started = Date.now();
  runLeagueCareer({
    seed: args.seed,
    seasons: args.seasons,
    gameSettings: settings,
    gameFidelity: FIDELITY,
    skipOwnerGameplay: true,
    saveId: "league_history_fixture",
    onSeasonComplete: (state, seasonIndex) => {
      const season = snapshotSeason(state);
      if (teams.length === 0) {
        teams = snapshotTeams(state);
      }
      seasons.push(season);
      const champion = teams.find(
        (team) => team.id === season.playoffs.championTeamId,
      );
      const championLabel = champion
        ? `${champion.city} ${champion.name}`
        : season.playoffs.championTeamId;
      console.error(
        `  season ${seasonIndex + 1}/${args.seasons}: ${season.seasonYear} champion=${championLabel}`,
      );
    },
  });

  if (seasons.length !== args.seasons) {
    throw new Error(
      `Expected ${args.seasons} season snapshots; got ${seasons.length}.`,
    );
  }

  const fixture: LeagueHistoryFixture = {
    meta: {
      seed: args.seed,
      seasons: args.seasons,
      fidelity: FIDELITY,
      skipOwnerGameplay: true,
      startingSeasonYear: seasons[0]!.seasonYear,
      teamCount: settings.league.teamCount,
      gamesPerTeam: settings.regularSeason.gamesPerTeam,
      playoffTeams: settings.playoffs.playoffTeams,
      seriesLength: settings.playoffs.seriesLength,
    },
    teams,
    seasons,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  const elapsedMs = Date.now() - started;
  console.error(
    `Wrote ${outPath} (${seasons.length} seasons) in ${(elapsedMs / 1000).toFixed(1)}s`,
  );
}

main();
