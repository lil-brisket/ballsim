import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { runAiTeamDecisions } from "@/systems/ai-team-decisions";
import { DEFAULT_ROSTER_SIZE } from "@/systems/roster-generation-config";
import {
  advanceOffseasonStage,
  processOffseasonLifecycle,
} from "@/systems/simulation/offseason-lifecycle";
import { transitionPhase } from "@/systems/simulation/phase-machine";
import { getTradeBlock } from "@/systems/trades";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { listFreeAgents, releasePlayerToFreeAgency } from "@/systems/free-agency";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

function aiTeamIds(state: GameState): TeamId[] {
  return (Object.keys(state.world.teams) as TeamId[]).filter(
    (id) => id !== state.user.controlledTeamId,
  );
}

function expireContractAndRelease(
  state: GameState,
  playerId: PlayerId,
): GameState {
  const player = state.world.players[playerId]!;
  const contractId = player.contractId;
  let next = state;
  if (contractId !== null && next.business.contracts[contractId]) {
    const contract = next.business.contracts[contractId]!;
    next = {
      ...next,
      business: {
        ...next.business,
        contracts: {
          ...next.business.contracts,
          [contractId]: {
            ...contract,
            endYear: next.competition.season.year - 1,
            salaryByYear: {},
          },
        },
      },
    };
  }
  return releasePlayerToFreeAgency(next, playerId).state;
}

function toFreeAgency(state: GameState, rng: ReturnType<typeof createSeededRng>): GameState {
  let current = transitionPhase(state, "regular").state;
  current = transitionPhase(current, "postseason").state;
  current = transitionPhase(current, "offseason").state;
  current = {
    ...current,
    competition: {
      ...current.competition,
      season: {
        ...current.competition.season,
        offseasonStage: "season_finalization",
      },
    },
  };
  return processOffseasonLifecycle(current, rng).state;
}

describe("AI team decisions", () => {
  it("does not modify the user-controlled team during free agency", () => {
    let state = createInitialGameState({ saveId: "ai_fa_user", rngSeed: 21 });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = toFreeAgency(state, rng);
    expect(state.competition.season.offseasonStage).toBe("free_agency");

    const userTeamId = state.user.controlledTeamId;
    const donorTeamId = aiTeamIds(state)[0]!;
    const donor = state.world.teams[donorTeamId]!;
    state = expireContractAndRelease(state, donor.roster[0]!);
    expect(listFreeAgents(state).playerIds.length).toBeGreaterThan(0);

    const userRosterBefore = [...state.world.teams[userTeamId]!.roster];
    const userContractsBefore = Object.values(state.business.contracts)
      .filter((contract) => contract.teamId === userTeamId)
      .map((contract) => contract.id)
      .sort();

    const result = runAiTeamDecisions(state, rng);
    expect([...result.state.world.teams[userTeamId]!.roster]).toEqual(
      userRosterBefore,
    );
    const userContractsAfter = Object.values(result.state.business.contracts)
      .filter((contract) => contract.teamId === userTeamId)
      .map((contract) => contract.id)
      .sort();
    expect(userContractsAfter).toEqual(userContractsBefore);
  });

  it("can sign a free agent for an AI team with roster need", () => {
    let state = createInitialGameState({ saveId: "ai_fa_sign", rngSeed: 22 });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = toFreeAgency(state, rng);

    const aiTeamId = aiTeamIds(state)[0]!;
    while (state.world.teams[aiTeamId]!.roster.length >= DEFAULT_ROSTER_SIZE) {
      const playerId = state.world.teams[aiTeamId]!.roster.at(-1)!;
      state = expireContractAndRelease(state, playerId);
    }

    const beforeCount = state.world.teams[aiTeamId]!.roster.length;
    const once = runAiTeamDecisions(state, rng);
    expect(once.state.world.teams[aiTeamId]!.roster.length).toBeGreaterThan(
      beforeCount,
    );

    const twice = runAiTeamDecisions(once.state, rng);
    expect(twice.state.world.teams[aiTeamId]!.roster.length).toBe(
      once.state.world.teams[aiTeamId]!.roster.length,
    );
  });

  it("is deterministic for the same RNG state", () => {
    let state = createInitialGameState({ saveId: "ai_det", rngSeed: 23 });
    const rngA = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rngA).state;
    state = toFreeAgency(state, rngA);

    const rng1 = createSeededRng(42);
    const rng2 = createSeededRng(42);
    const a = runAiTeamDecisions(state, rng1).state;
    const b = runAiTeamDecisions(state, rng2).state;
    expect(a.user.appliedGameplayConsequenceKeys).toEqual(
      b.user.appliedGameplayConsequenceKeys,
    );
    expect(a.business.freeAgency.offers).toEqual(b.business.freeAgency.offers);
  });

  it("does not churn trade blocks every day beyond one surplus listing", () => {
    let state = createInitialGameState({ saveId: "ai_tb", rngSeed: 24 });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const aiTeamId = aiTeamIds(state)[0]!;
    const once = runAiTeamDecisions(state, rng).state;
    const blockOnce = getTradeBlock(once, aiTeamId);
    const twice = runAiTeamDecisions(once, rng).state;
    const blockTwice = getTradeBlock(twice, aiTeamId);
    expect(blockTwice.assets.filter((a) => a.kind === "player").length).toBe(
      blockOnce.assets.filter((a) => a.kind === "player").length,
    );
  });

  it("stops draft selection when the user team is on the clock", () => {
    let state = createInitialGameState({ saveId: "ai_draft", rngSeed: 25 });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    state = toFreeAgency(state, rng);
    state = advanceOffseasonStage(state).state;
    state = processOffseasonLifecycle(state, rng).state;
    expect(state.competition.season.offseasonStage).toBe("draft");

    const draftBefore = Object.values(state.world.drafts)[0]!;
    // Force the user team onto the clock as the first available slot.
    const userTeamId = state.user.controlledTeamId;
    const firstAvailableIndex = draftBefore.order.findIndex(
      (slot) => slot.status === "available",
    );
    expect(firstAvailableIndex).toBeGreaterThanOrEqual(0);
    const order = draftBefore.order.map((slot, index) =>
      index === firstAvailableIndex
        ? { ...slot, ownerTeamId: userTeamId }
        : slot,
    );
    state = {
      ...state,
      world: {
        ...state.world,
        drafts: {
          ...state.world.drafts,
          [draftBefore.id]: { ...draftBefore, order },
        },
      },
    };

    const userSelectionsBefore = draftBefore.selections.filter(
      (selection) => selection.teamId === userTeamId,
    ).length;

    const result = runAiTeamDecisions(state, rng).state;
    const draft = Object.values(result.world.drafts)[0]!;
    expect(draft.status).toBe("active");
    const onClock = draft.order.find((slot) => slot.status === "available");
    expect(onClock).toBeDefined();
    expect(onClock!.ownerTeamId).toBe(userTeamId);
    const userSelectionsAfter = draft.selections.filter(
      (selection) => selection.teamId === userTeamId,
    ).length;
    expect(userSelectionsAfter).toBe(userSelectionsBefore);
  });
});
