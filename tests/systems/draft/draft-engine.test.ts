import { describe, expect, it } from "vitest";
import {
  createDraftPick,
} from "@/domain/entities/draft-pick";
import { draftClassIdFor } from "@/domain/entities/draft";
import { asDraftPickId, asPlayerId, asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { DRAFT_EXTRA_PROSPECTS_PER_TEAM } from "@/systems/draft-config";
import {
  activateDraft,
  completeDraft,
  createDraft,
  draftYearForSeason,
  generateDraftOrder,
  makeDraftSelection,
} from "@/systems/draft";
import { developPlayer } from "@/systems/player-development";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { isFreeAgent, listFreeAgents } from "@/systems/free-agency";
import { createDraftFixture, sortedTeamIds } from "./fixture";
import { TEST_RNG_SEED } from "../../helpers/determinism";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";

describe("draft class creation", () => {
  it("creates a draft class with ranked prospects and reserved ids", () => {
    resetDomainEventSequenceForTests();
    const state = createDraftFixture();
    const rng = createSeededRng(TEST_RNG_SEED);
    const result = createDraft(state, rng);
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draftId = draftClassIdFor(draftYear);
    const draft = result.state.world.drafts[draftId]!;

    expect(draft).toBeDefined();
    expect(draft.status).toBe("not_started");
    expect(draft.seasonYear).toBe(draftYear);

    const teamCount = Object.keys(state.world.teams).length;
    const pickCount = Object.values(state.world.draftPicks).filter(
      (pick) => pick.seasonYear === draftYear,
    ).length;
    expect(Object.keys(draft.prospects)).toHaveLength(
      pickCount + teamCount * DRAFT_EXTRA_PROSPECTS_PER_TEAM,
    );

    for (const prospect of Object.values(draft.prospects)) {
      expect(prospect.playerId).toBe(prospect.player.id);
      expect(prospect.playerId.startsWith(`prospect_${draftId}_`)).toBe(true);
      expect(prospect.player.teamId).toBeNull();
      expect(prospect.player.contractId).toBeNull();
      expect(prospect.status).toBe("eligible");
      expect(result.state.world.players[prospect.playerId]).toBeUndefined();
    }

    const rankings = Object.values(draft.prospects)
      .map((p) => p.ranking)
      .sort((a, b) => a - b);
    expect(rankings).toEqual(
      Array.from({ length: rankings.length }, (_, i) => i + 1),
    );
  });

  it("is deterministic for the same seed and state", () => {
    const state = createDraftFixture();
    const a = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const b = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draftId = draftClassIdFor(draftYear);
    expect(a.world.drafts[draftId]).toEqual(b.world.drafts[draftId]);
  });
});

describe("draft order", () => {
  it("produces total deterministic order with draftPickId tie-break", () => {
    let state = createDraftFixture();
    const draftYear = draftYearForSeason(state.competition.season.year);
    const teams = sortedTeamIds(state);
    const worstTeam = teams[0]!;
    const extraId = asDraftPickId(`pick_extra_${worstTeam}_${draftYear}_r1`);
    state = {
      ...state,
      world: {
        ...state.world,
        draftPicks: {
          ...state.world.draftPicks,
          [extraId]: createDraftPick({
            id: extraId,
            originalTeamId: worstTeam,
            ownerTeamId: teams[1]!,
            seasonYear: draftYear,
            round: 1,
          }),
        },
      },
    };

    const order = generateDraftOrder(state, draftYear);
    const round1 = order.filter((slot) => slot.round === 1);
    const fromWorst = round1.filter((slot) => {
      const pick = state.world.draftPicks[slot.draftPickId]!;
      return pick.originalTeamId === worstTeam;
    });
    expect(fromWorst.length).toBeGreaterThanOrEqual(2);
    expect(fromWorst[0]!.draftPickId < fromWorst[1]!.draftPickId).toBe(true);

    const again = generateDraftOrder(state, draftYear);
    expect(again).toEqual(order);

    expect(order.map((s) => s.overallPick)).toEqual(
      Array.from({ length: order.length }, (_, i) => i + 1),
    );

    // Reverse standings: fewer wins draft earlier within a round.
    const round1OriginalWins = round1.map((slot) => {
      const pick = state.world.draftPicks[slot.draftPickId]!;
      return state.competition.standings.byTeamId[pick.originalTeamId]!.wins;
    });
    for (let i = 1; i < round1OriginalWins.length; i += 1) {
      expect(round1OriginalWins[i]!).toBeGreaterThanOrEqual(
        round1OriginalWins[i - 1]!,
      );
    }
  });

  it("copies ownerTeamId from pick assets at generation", () => {
    const state = createDraftFixture();
    const draftYear = draftYearForSeason(state.competition.season.year);
    const order = generateDraftOrder(state, draftYear);
    for (const slot of order) {
      expect(slot.ownerTeamId).toBe(
        state.world.draftPicks[slot.draftPickId]!.ownerTeamId,
      );
      expect(slot.status).toBe("available");
    }
  });
});

describe("draft scouting", () => {
  it("generates team-specific reports without mutating prospects", () => {
    const state = createDraftFixture();
    const before = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draftId = draftClassIdFor(draftYear);
    const draft = before.world.drafts[draftId]!;

    const prospectSnapshots = structuredClone(draft.prospects);
    const teams = sortedTeamIds(before);
    expect(draft.scouting.length).toBe(
      teams.length * Object.keys(draft.prospects).length,
    );

    const prospectPlayerId = Object.keys(draft.prospects)[0]!;
    const reportsForProspect = draft.scouting.filter(
      (report) => report.prospectPlayerId === prospectPlayerId,
    );
    expect(reportsForProspect.length).toBe(teams.length);
    expect(reportsForProspect[0]).not.toEqual(reportsForProspect[1]);

    expect(draft.prospects).toEqual(prospectSnapshots);

    const again = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    expect(again.world.drafts[draftId]!.scouting).toEqual(draft.scouting);
  });
});

describe("draft lifecycle and selection", () => {
  it("activates, selects with exact identity, and rejects invalid ops", () => {
    resetDomainEventSequenceForTests();
    let state = createDraftFixture();
    const rng = createSeededRng(TEST_RNG_SEED);
    state = createDraft(state, rng).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draftId = draftClassIdFor(draftYear);

    const beforeActivate = makeDraftSelection(state, {
      draftClassId: draftId,
      draftPickId: state.world.drafts[draftId]!.order[0]!.draftPickId,
      prospectPlayerId: Object.keys(state.world.drafts[draftId]!.prospects)[0] as never,
      teamId: state.world.drafts[draftId]!.order[0]!.ownerTeamId,
    });
    expect(beforeActivate.success).toBe(false);
    expect(beforeActivate.validation.errors.some((e) => e.code === "DRAFT_NOT_ACTIVE")).toBe(
      true,
    );

    state = activateDraft(state, draftId).state;
    expect(state.world.drafts[draftId]!.status).toBe("active");

    const draft = state.world.drafts[draftId]!;
    const slot = draft.order[0]!;
    const prospect = Object.values(draft.prospects).find(
      (p) => p.status === "eligible",
    )!;
    const snapshotBefore = structuredClone(prospect.player);

    const faBefore = listFreeAgents(state).playerIds;
    expect(faBefore.includes(prospect.playerId)).toBe(false);
    expect(isFreeAgent(state, prospect.playerId)).toBe(false);

    const wrongOwner = makeDraftSelection(state, {
      draftClassId: draftId,
      draftPickId: slot.draftPickId,
      prospectPlayerId: prospect.playerId,
      teamId: asTeamId(
        sortedTeamIds(state).find((id) => id !== slot.ownerTeamId)!,
      ),
    });
    expect(wrongOwner.success).toBe(false);
    expect(
      wrongOwner.validation.errors.some((e) => e.code === "TEAM_OWNERSHIP"),
    ).toBe(true);

    const selected = makeDraftSelection(state, {
      draftClassId: draftId,
      draftPickId: slot.draftPickId,
      prospectPlayerId: prospect.playerId,
      teamId: slot.ownerTeamId,
    });
    expect(selected.success).toBe(true);
    state = selected.state;

    const player = state.world.players[prospect.playerId]!;
    expect(player).toBeDefined();
    expect(player.id).toBe(prospect.playerId);
    expect(player.attributes).toEqual(snapshotBefore.attributes);
    expect(player.potential).toEqual(snapshotBefore.potential);
    expect(player.firstName).toBe(snapshotBefore.firstName);
    expect(player.teamId).toBe(slot.ownerTeamId);
    expect(player.contractId).toBe(`contract_${prospect.playerId}`);
    expect(state.world.teams[slot.ownerTeamId]!.roster).toContain(
      prospect.playerId,
    );

    const contract = state.business.contracts[player.contractId!]!;
    expect(contract.startYear).toBe(state.competition.season.year);
    expect(contract.endYear).toBe(state.competition.season.year + 1);
    expect(isFreeAgent(state, prospect.playerId)).toBe(false);

    const usedPick = makeDraftSelection(state, {
      draftClassId: draftId,
      draftPickId: slot.draftPickId,
      prospectPlayerId: Object.values(state.world.drafts[draftId]!.prospects).find(
        (p) => p.status === "eligible",
      )!.playerId,
      teamId: slot.ownerTeamId,
    });
    expect(usedPick.success).toBe(false);
    expect(usedPick.validation.errors.some((e) => e.code === "PICK_USED")).toBe(
      true,
    );

    const duplicateProspect = makeDraftSelection(state, {
      draftClassId: draftId,
      draftPickId: state.world.drafts[draftId]!.order[1]!.draftPickId,
      prospectPlayerId: prospect.playerId,
      teamId: state.world.drafts[draftId]!.order[1]!.ownerTeamId,
    });
    expect(duplicateProspect.success).toBe(false);
    expect(
      duplicateProspect.validation.errors.some(
        (e) => e.code === "PROSPECT_SELECTED",
      ),
    ).toBe(true);

    const invalidProspect = makeDraftSelection(state, {
      draftClassId: draftId,
      draftPickId: state.world.drafts[draftId]!.order[1]!.draftPickId,
      prospectPlayerId: asPlayerId("prospect_missing"),
      teamId: state.world.drafts[draftId]!.order[1]!.ownerTeamId,
    });
    expect(invalidProspect.success).toBe(false);

    state = completeDraft(state, draftId).state;
    expect(state.world.drafts[draftId]!.status).toBe("complete");

    const afterComplete = makeDraftSelection(state, {
      draftClassId: draftId,
      draftPickId: state.world.drafts[draftId]!.order[1]!.draftPickId,
      prospectPlayerId: Object.values(state.world.drafts[draftId]!.prospects).find(
        (p) => p.status === "eligible",
      )!.playerId,
      teamId: state.world.drafts[draftId]!.order[1]!.ownerTeamId,
    });
    expect(afterComplete.success).toBe(false);

    const remainingEligible = Object.values(
      state.world.drafts[draftId]!.prospects,
    ).filter((p) => p.status === "eligible");
    expect(remainingEligible.length).toBeGreaterThan(0);
    for (const remaining of remainingEligible) {
      expect(state.world.players[remaining.playerId]).toBeUndefined();
      expect(listFreeAgents(state).playerIds.includes(remaining.playerId)).toBe(
        false,
      );
    }

    const overall = calculatePlayerOverall(player.position, player.attributes);
    expect(overall).toBeGreaterThan(0);
    const developed = developPlayer(player, createSeededRng(7));
    expect(developed.id).toBe(player.id);
  });
});

describe("draft persistence", () => {
  it("round-trips an active draft with selections", () => {
    resetDomainEventSequenceForTests();
    let state = createDraftFixture();
    state = createDraft(state, createSeededRng(TEST_RNG_SEED)).state;
    const draftYear = draftYearForSeason(state.competition.season.year);
    const draftId = draftClassIdFor(draftYear);
    state = activateDraft(state, draftId).state;

    const draft = state.world.drafts[draftId]!;
    const slot = draft.order[0]!;
    const prospect = Object.values(draft.prospects)[0]!;
    state = makeDraftSelection(state, {
      draftClassId: draftId,
      draftPickId: slot.draftPickId,
      prospectPlayerId: prospect.playerId,
      teamId: slot.ownerTeamId,
    }).state;

    const restored = deserializeGameState(serializeGameState(state));
    expect(restored.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(restored.world.drafts[draftId]!.status).toBe("active");
    expect(restored.world.drafts[draftId]!.selections).toHaveLength(1);
    expect(restored.world.players[prospect.playerId]).toBeDefined();
    expect(restored.world.drafts[draftId]).toEqual(state.world.drafts[draftId]);
  });

  it("migrates v18 saves to empty drafts", () => {
    const modern = createDraftFixture();
    const v18 = {
      ...modern,
      meta: { ...modern.meta, schemaVersion: 18 },
      world: {
        calendar: modern.world.calendar,
        league: modern.world.league,
        conferences: modern.world.conferences,
        divisions: modern.world.divisions,
        teams: modern.world.teams,
        players: modern.world.players,
        coaches: modern.world.coaches,
        staff: modern.world.staff,
        draftPicks: modern.world.draftPicks,
      },
    };
    const migrated = deserializeGameState(JSON.stringify(v18));
    expect(migrated.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(migrated.world.drafts).toEqual({});
  });
});
