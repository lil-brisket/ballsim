import { draftClassIdFor, type DraftClass } from "@/domain/entities/draft";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  countDraftPicksForYear,
  draftYearForSeason,
  generateDraftOrder,
} from "@/systems/draft/draft-order";
import { generateDraftProspects } from "@/systems/draft/draft-prospects";
import {
  generateAllTeamScouting,
  generateDraftScouting,
} from "@/systems/draft/draft-scouting";
import { buildDraftProspectsFromPackage } from "@/systems/custom-content/apply-draft-class";
import { validateDraftClassPackage } from "@/systems/custom-content/validate-draft-class";
import type { DraftClassPackage } from "@/systems/custom-content/package-types";
import {
  ensureDraftClassDecision,
  getDraftClassDecision,
  withDraftClassDecision,
} from "@/systems/custom-content/draft-class-decision";

function insertPopulatedDraft(
  state: GameState,
  rng: Rng,
  draftYear: number,
  prospects: DraftClass["prospects"],
): SystemResult {
  const draftClassId = draftClassIdFor(draftYear);
  if (state.world.drafts[draftClassId] !== undefined) {
    throw new Error(`Draft class "${draftClassId}" already exists.`);
  }
  if (Object.keys(state.world.teams).length < 1) {
    throw new Error("Cannot create draft: no teams in world.");
  }
  if (countDraftPicksForYear(state, draftYear) < 1) {
    throw new Error(
      `Cannot create draft: no draft picks for seasonYear ${draftYear}.`,
    );
  }

  const order = generateDraftOrder(state, draftYear);
  const scouting = generateDraftScouting(state, rng, prospects);
  const teamDraftState = generateAllTeamScouting(state, rng, prospects);
  const draftClass: DraftClass = {
    id: draftClassId,
    seasonYear: draftYear,
    status: "not_started",
    prospects,
    order,
    scouting,
    selections: [],
    teamDraftState,
    pickResults: [],
  };
  return systemResult({
    ...state,
    world: {
      ...state.world,
      drafts: {
        ...state.world.drafts,
        [draftClassId]: draftClass,
      },
    },
  });
}

/**
 * Atomically creates a full DraftClass (prospects + order + scouting).
 * Inserts into world.drafts only after the complete aggregate is built.
 * Status is not_started. Callers must persist rng.getState() on success.
 */
export function createDraft(state: GameState, rng: Rng): SystemResult {
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  if (state.world.drafts[draftClassId] !== undefined) {
    throw new Error(`Draft class "${draftClassId}" already exists.`);
  }
  const prospects = generateDraftProspects(state, rng, draftClassId, draftYear);
  return insertPopulatedDraft(state, rng, draftYear, prospects);
}

export function createDraftFromPackage(
  state: GameState,
  rng: Rng,
  rosterPackage: unknown,
): SystemResult {
  const seasonYear = state.competition.season.year;
  const expectedYear = draftYearForSeason(seasonYear);
  const validated = validateDraftClassPackage(rosterPackage, {
    schemaVersion: state.meta.schemaVersion,
    seasonYear,
    draftHorizonYear: seasonYear + 3,
    existingPlayerIds: new Set(Object.keys(state.world.players)),
  });
  if (!validated.ok || validated.normalized === undefined) {
    const message = validated.errors.map((entry) => entry.message).join("; ");
    throw new Error(
      message.length > 0
        ? `Custom draft class package is invalid: ${message}`
        : "Custom draft class package is invalid.",
    );
  }
  const pkg: DraftClassPackage = validated.normalized;
  if (pkg.payload.draftYear !== expectedYear) {
    throw new Error(
      `Custom draft class year ${pkg.payload.draftYear} does not match ${expectedYear}.`,
    );
  }
  const prospects = buildDraftProspectsFromPackage(pkg);
  return insertPopulatedDraft(state, rng, expectedYear, prospects);
}

export function replaceDraftProspects(
  state: GameState,
  rng: Rng,
  rosterPackage: unknown,
): SystemResult {
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  const existing = state.world.drafts[draftClassId];
  if (existing !== undefined) {
    if (existing.status !== "not_started" || existing.selections.length > 0) {
      throw new Error(
        `Cannot replace draft class "${draftClassId}" while status is ${existing.status}.`,
      );
    }
  }
  const withoutDraft: GameState = {
    ...state,
    world: {
      ...state.world,
      drafts: Object.fromEntries(
        Object.entries(state.world.drafts).filter(([id]) => id !== draftClassId),
      ),
    },
  };
  return createDraftFromPackage(withoutDraft, rng, rosterPackage);
}

export function autoResolveGeneratedDraftClass(
  state: GameState,
  rng: Rng,
): SystemResult {
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  let current = ensureDraftClassDecision(state, draftYear);
  const decision = getDraftClassDecision(current, draftYear);
  if (decision?.resolved === true) {
    if (
      current.world.drafts[draftClassId] === undefined &&
      decision.source === "generated"
    ) {
      return createDraft(current, rng);
    }
    return systemResult(current);
  }
  current = withDraftClassDecision(current, {
    draftYear,
    resolved: true,
    source: "generated",
  });
  if (current.world.drafts[draftClassId] === undefined) {
    const created = createDraft(current, rng);
    return systemResult(created.state, created.events);
  }
  return systemResult(current);
}

/**
 * Create the season's draft class only when the rookie-class decision is resolved.
 * Custom classes are created by the resolve command, not here.
 */
export function maybeCreateDraftForDecision(
  state: GameState,
  rng: Rng,
): SystemResult {
  const draftYear = draftYearForSeason(state.competition.season.year);
  const draftClassId = draftClassIdFor(draftYear);
  let current = ensureDraftClassDecision(state, draftYear);
  if (current.world.drafts[draftClassId] !== undefined) {
    return systemResult(current);
  }
  const decision = getDraftClassDecision(current, draftYear);
  if (decision === undefined || decision.resolved !== true) {
    return systemResult(current);
  }
  if (decision.source === "generated") {
    const created = createDraft(current, rng);
    return systemResult(created.state, created.events);
  }
  throw new Error(
    `Custom draft class for ${draftYear} was selected but is not loaded.`,
  );
}
