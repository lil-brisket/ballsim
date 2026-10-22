import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import type { PlayerId, TeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { toFreeAgentInterestView } from "@/state/free-agent-interest-selectors";
import { evaluateInterestAtSalary } from "@/systems/free-agency";
import { readFreeAgentMotivations } from "@/systems/free-agency-motivations";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { bootstrapWorld } from "@/systems/world-pipeline";

function league(): GameState {
  const initial = createInitialGameState({
    saveId: "fa_motivations",
    rngSeed: 71,
    settings: CBL_GAME_SETTINGS,
  });
  return bootstrapWorld(initial, createSeededRng(initial.meta.rngState)).state;
}

function teams(state: GameState): TeamId[] {
  return Object.keys(state.world.teams).sort() as TeamId[];
}

function withPersonality(
  state: GameState,
  playerId: PlayerId,
  personality: Partial<GameState["world"]["players"][string]["personality"]>,
): GameState {
  const player = state.world.players[playerId]!;
  return {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: {
          ...player,
          personality: { ...player.personality, ...personality },
        },
      },
    },
  };
}

function points(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
  motivation: string,
): number {
  return readFreeAgentMotivations(state, playerId, teamId).find(
    (r) => r.motivation === motivation,
  )!.points;
}

function withRecord(
  state: GameState,
  teamId: TeamId,
  wins: number,
  losses: number,
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      standings: {
        byTeamId: {
          ...state.competition.standings.byTeamId,
          [teamId]: {
            ...state.competition.standings.byTeamId[teamId]!,
            wins,
            losses,
          },
        },
      },
    },
  };
}

describe("free-agent motivations", () => {
  it("rate a winning team above a losing one, more for competitive players", () => {
    let state = league();
    const [good, bad, home] = teams(state);
    const playerId = state.world.teams[home!]!.roster[0]!;
    state = withRecord(withRecord(state, good!, 18, 2), bad!, 2, 18);
    expect(points(state, playerId, good!, "winning")).toBeGreaterThan(
      points(state, playerId, bad!, "winning"),
    );
    const fierce = withPersonality(state, playerId, { competitiveness: 90 });
    const mellow = withPersonality(state, playerId, { competitiveness: 40 });
    expect(points(fierce, playerId, good!, "winning")).toBeGreaterThan(
      points(mellow, playerId, good!, "winning"),
    );
  });

  it("give loyal players a bonus for their own team only", () => {
    const state = league();
    const [home, other] = teams(state);
    const playerId = state.world.teams[home!]!.roster[0]!;
    const loyal = withPersonality(state, playerId, { loyalty: 90 });
    expect(points(loyal, playerId, home!, "loyalty")).toBeGreaterThan(0);
    expect(points(loyal, playerId, other!, "loyalty")).toBe(0);
    const fickle = withPersonality(state, playerId, { loyalty: 40 });
    expect(points(loyal, playerId, home!, "loyalty")).toBeGreaterThan(
      points(fickle, playerId, home!, "loyalty"),
    );
  });

  it("are deterministic and the same for owner and CPU teams", () => {
    const state = league();
    const [home, other] = teams(state);
    const playerId = state.world.teams[home!]!.roster[0]!;
    const asCpu: GameState = {
      ...state,
      user: { ...state.user, ownedTeamIds: [] },
    };
    expect(readFreeAgentMotivations(asCpu, playerId, other!)).toEqual(
      readFreeAgentMotivations(state, playerId, other!),
    );
    expect(readFreeAgentMotivations(state, playerId, other!)).toEqual(
      readFreeAgentMotivations(state, playerId, other!),
    );
  });
});

describe("salary still dominates", () => {
  it("a market offer beats every other factor for a low-trait player", () => {
    let state = league();
    const [good, bad, home] = teams(state);
    const playerId = state.world.teams[home!]!.roster[0]!;
    state = withPersonality(
      withRecord(withRecord(state, good!, 20, 0), bad!, 0, 20),
      playerId,
      { competitiveness: 40, loyalty: 40 },
    );
    const cap = getLeagueSalaryCap(state);
    const rich = evaluateInterestAtSalary(state, playerId, bad!, cap * 0.35);
    const cheap = evaluateInterestAtSalary(state, playerId, good!, 600_000);
    expect(rich.score).toBeGreaterThan(cheap.score);
  });
});

describe("interest panel", () => {
  it("names what he cares about and a salary that gets him interested", () => {
    const state = league();
    const [home, other] = teams(state);
    const playerId = state.world.teams[home!]!.roster[0]!;
    const view = toFreeAgentInterestView(state, playerId, other!)!;
    expect(view.caresAbout).toHaveLength(2);
    expect(view.factors.map((f) => f.label)).toContain("winning");
    if (view.salaryToSign !== null) {
      expect(
        evaluateInterestAtSalary(state, playerId, other!, view.salaryToSign)
          .interested,
      ).toBe(true);
    }
  });
});
