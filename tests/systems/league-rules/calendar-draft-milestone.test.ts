import { describe, expect, it } from "vitest";
import {
  createEmptyDraftClass,
  draftClassIdFor,
  type DraftClass,
} from "@/domain/entities/draft";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { getLeagueMilestones } from "@/systems/league-rules/calendar-events";
import { setActivePhase } from "@/systems/phase-engine";
import { bootstrapWorld } from "@/systems/world-pipeline";

/**
 * The draft milestones follow this season's draft class. world.drafts also
 * holds last year's completed class, which the milestones used to read when
 * it came first.
 */
function rosterDecisionsWith(currentStatus: DraftClass["status"]): GameState {
  const initial = createInitialGameState({
    saveId: "calendar_draft_milestone",
    rngSeed: 5,
    settings: CBL_GAME_SETTINGS,
  });
  const booted = bootstrapWorld(
    initial,
    createSeededRng(initial.meta.rngState),
  ).state;
  const year = booted.competition.season.year;
  const lastYear: DraftClass = {
    ...createEmptyDraftClass({ id: draftClassIdFor(year), seasonYear: year }),
    status: "complete",
  };
  const thisYear: DraftClass = {
    ...createEmptyDraftClass({
      id: draftClassIdFor(year + 1),
      seasonYear: year + 1,
    }),
    status: currentStatus,
  };
  const state: GameState = {
    ...booted,
    world: {
      ...booted.world,
      drafts: { [lastYear.id]: lastYear, [thisYear.id]: thisYear },
    },
  };
  return setActivePhase(state, "offseason.roster_decisions");
}

function milestone(state: GameState, key: string) {
  return getLeagueMilestones(state).find((entry) => entry.key === key)!;
}

describe("calendar draft milestones", () => {
  it("are not reached before this season's draft, whatever last year's class says", () => {
    const state = rosterDecisionsWith("not_started");
    expect(milestone(state, "draftStart").reached).toBe(false);
    expect(milestone(state, "draftComplete").reached).toBe(false);
  });

  it("are reached once this season's draft is complete", () => {
    const state = rosterDecisionsWith("complete");
    expect(milestone(state, "draftComplete").reached).toBe(true);
    expect(milestone(state, "draftStart").reached).toBe(true);
  });
});
