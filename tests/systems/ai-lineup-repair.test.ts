import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import {
  createPlayer,
  playerCanPlay,
  playsPosition,
  type Player,
} from "@/domain/entities/player";
import type { TeamId } from "@/domain/ids";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import {
  missingPositions,
  repairTeamLineup,
  runAiTeamDecisions,
} from "@/systems/ai-team-decisions";
import { listFreeAgents } from "@/systems/free-agency";
import { generatePlayer } from "@/systems/player-generation";
import { bootstrapWorld } from "@/systems/world-pipeline";

function seasonState(): GameState {
  let state = createInitialGameState({
    saveId: "ai_lineup_repair",
    rngSeed: 311,
    settings: CBL_GAME_SETTINGS,
  });
  state = bootstrapWorld(state, createSeededRng(state.meta.rngState)).state;
  return {
    ...state,
    competition: {
      ...state.competition,
      season: { ...state.competition.season, phase: "regular" },
    },
  };
}

function aiTeam(state: GameState): TeamId {
  return (Object.keys(state.world.teams) as TeamId[])
    .filter((id) => id !== state.user.activeOwnerTeamId)
    .sort()[0]!;
}

function rosterPlayers(state: GameState, teamId: TeamId): Player[] {
  return state.world.teams[teamId]!.roster.map(
    (id) => state.world.players[id]!,
  );
}

/** Injures every healthy player who can play `position` on the team. */
function injureEveryone(
  state: GameState,
  teamId: TeamId,
  position: "PG" | "SG" | "SF" | "PF" | "C",
): GameState {
  const players = { ...state.world.players };
  for (const player of rosterPlayers(state, teamId)) {
    if (playsPosition(player, position)) {
      players[player.id] = createPlayer({ ...player, availability: "out" });
    }
  }
  return { ...state, world: { ...state.world, players } };
}

/** Retires every current free agent who plays `position`. */
function withoutFreeAgentsAt(
  state: GameState,
  position: "PG" | "SG" | "SF" | "PF" | "C",
): GameState {
  const players = { ...state.world.players };
  for (const id of listFreeAgents(state).playerIds) {
    const player = players[id]!;
    if (playsPosition(player, position)) {
      players[id] = createPlayer({ ...player, retired: true });
    }
  }
  return { ...state, world: { ...state.world, players } };
}

function withFreeAgent(
  state: GameState,
  position: "PG" | "SG" | "SF" | "PF" | "C",
): { state: GameState; id: string } {
  const freeAgent = generatePlayer("repair_fa", {
    position,
    quality: 12,
    teamId: null,
    contractId: null,
  });
  return {
    state: {
      ...state,
      world: {
        ...state.world,
        players: { ...state.world.players, [freeAgent.id]: freeAgent },
      },
    },
    id: freeAgent.id,
  };
}

describe("AI lineup repair for injuries", () => {
  it("counts healthy players only, at their natural positions", () => {
    const state = seasonState();
    const teamId = aiTeam(state);
    const before = missingPositions(state, teamId);
    const injured = injureEveryone(state, teamId, "C");
    expect(missingPositions(injured, teamId)).toContain("C");
    expect(missingPositions(injured, teamId).length).toBeGreaterThanOrEqual(
      before.length,
    );
  });

  it("signs a free agent for the position injuries left open", () => {
    let state = seasonState();
    const teamId = aiTeam(state);
    state = injureEveryone(state, teamId, "C");
    state = withFreeAgent(state, "C").state;
    expect(missingPositions(state, teamId)).toContain("C");
    const before = new Set(state.world.teams[teamId]!.roster);

    const after = runAiTeamDecisions(state, createSeededRng(5)).state;

    const joined = rosterPlayers(after, teamId).filter(
      (player) => !before.has(player.id),
    );
    expect(joined.length).toBeGreaterThanOrEqual(1);
    expect(joined.some((player) => playsPosition(player, "C"))).toBe(true);
    expect(missingPositions(after, teamId)).not.toContain("C");
  });

  it("signs at most one replacement a day", () => {
    let state = seasonState();
    const teamId = aiTeam(state);
    state = injureEveryone(state, teamId, "C");
    state = withFreeAgent(state, "C").state;
    const once = runAiTeamDecisions(state, createSeededRng(5)).state;
    const rosterSize = once.world.teams[teamId]!.roster.length;
    const twice = runAiTeamDecisions(once, createSeededRng(6)).state;
    expect(twice.world.teams[teamId]!.roster.length).toBe(rosterSize);
  });

  it("does nothing when no free agent plays the open position", () => {
    let state = seasonState();
    const teamId = aiTeam(state);
    state = injureEveryone(state, teamId, "C");
    state = withoutFreeAgentsAt(state, "C");
    state = withFreeAgent(state, "PG").state;
    const rosterBefore = state.world.teams[teamId]!.roster;
    // The repair on its own: the daily step would first top the pool up.
    const result = repairTeamLineup(state, teamId);
    expect(result.signed).toBe(false);
    expect(result.state.world.teams[teamId]!.roster).toEqual(rosterBefore);
    expect(missingPositions(result.state, teamId)).toContain("C");
  });

  it("finds a center in the topped-up pool when the league had none", () => {
    let state = seasonState();
    const teamId = aiTeam(state);
    state = injureEveryone(state, teamId, "C");
    state = withoutFreeAgentsAt(state, "C");
    const after = runAiTeamDecisions(state, createSeededRng(5)).state;
    expect(missingPositions(after, teamId)).not.toContain("C");
  });

  it("waives the injured backup center when no one else can be waived", () => {
    let state = seasonState();
    const teamId = aiTeam(state);
    state = injureEveryone(state, teamId, "C");
    // Everyone but the centers is on a big guaranteed deal (too much dead
    // money to waive); the injured centers are cheap.
    const year = state.competition.season.year;
    const contracts = { ...state.business.contracts };
    for (const player of rosterPlayers(state, teamId)) {
      const contract = contracts[player.contractId!]!;
      // Only primary centers are cheap; a forward who also plays center is not.
      const cheap = player.position === "C";
      const salaryByYear: Record<string, number> = {};
      for (let y = year; y <= year + 3; y += 1) {
        salaryByYear[String(y)] = cheap ? 500_000 : 30_000_000;
      }
      contracts[player.contractId!] = {
        ...contract,
        startYear: year,
        endYear: cheap ? year : year + 3,
        salaryByYear: cheap ? { [String(year)]: 500_000 } : salaryByYear,
      };
    }
    state = { ...state, business: { ...state.business, contracts } };
    state = withFreeAgent(withoutFreeAgentsAt(state, "C"), "C").state;
    const rosterBefore = state.world.teams[teamId]!.roster;
    expect(rosterBefore).toHaveLength(15);
    const injuredCenters = rosterPlayers(state, teamId).filter(
      (p) => !playerCanPlay(p) && playsPosition(p, "C"),
    );
    expect(injuredCenters.length).toBeGreaterThan(0);

    const result = repairTeamLineup(state, teamId);

    expect(result.signed).toBe(true);
    const after = rosterPlayers(result.state, teamId);
    expect(after).toHaveLength(15);
    expect(missingPositions(result.state, teamId)).not.toContain("C");
    // One of the injured centers made room; no healthy player was lost.
    const lost = rosterBefore.filter(
      (id) => !result.state.world.teams[teamId]!.roster.includes(id),
    );
    expect(lost).toHaveLength(1);
    expect(playerCanPlay(state.world.players[lost[0]!]!)).toBe(false);
  });

  it("does not repair outside preseason and the regular season", () => {
    let state = seasonState();
    const teamId = aiTeam(state);
    state = injureEveryone(state, teamId, "C");
    const added = withFreeAgent(state, "C");
    const offseason = {
      ...added.state,
      competition: {
        ...added.state.competition,
        season: {
          ...added.state.competition.season,
          phase: "playoffs" as const,
        },
      },
    };
    const sizeBefore = offseason.world.teams[teamId]!.roster.length;
    const after = runAiTeamDecisions(offseason, createSeededRng(5)).state;
    expect(after.world.players[added.id]!.teamId).toBeNull();
    expect(after.world.teams[teamId]!.roster.length).toBeLessThanOrEqual(
      sizeBefore,
    );
  });

  it("never touches the user's team", () => {
    let state = seasonState();
    const userTeam = state.user.activeOwnerTeamId;
    state = injureEveryone(state, userTeam, "C");
    const added = withFreeAgent(state, "C");
    const sizeBefore = added.state.world.teams[userTeam]!.roster.length;
    const after = runAiTeamDecisions(added.state, createSeededRng(5)).state;
    expect(after.world.teams[userTeam]!.roster.length).toBe(sizeBefore);
    expect(after.world.players[added.id]!.teamId).not.toBe(userTeam);
  });
});
