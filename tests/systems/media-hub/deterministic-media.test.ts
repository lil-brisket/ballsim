import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import {
  createDomainEvent,
  resetDomainEventSequenceForTests,
} from "@/domain/events/domain-event";
import { asDomainEventId, asPlayerId, asTeamId } from "@/domain/ids";
import {
  generateHeadline,
  processDerivedProjections,
  processMediaFromEvents,
} from "@/systems/media-hub";
import { toSourceKey } from "@/domain/entities/event-source";
import { createEmptyMediaFeed } from "@/domain/entities/media-item";
import { createEmptySocialFeed } from "@/domain/entities/social-post";
import { getActiveOwnedFranchise } from "@/state/owner-context";

function bootRegular(saveId: string, seed: number) {
  resetDomainEventSequenceForTests();
  const state = createInitialGameState({
    saveId,
    rngSeed: seed,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  let current = bootstrapWorld(state, rng).state;
  current = beginRegularSeasonFromPreseason(current).state;
  return { state: current, rng };
}

describe("deterministic media generation", () => {
  it("produces the same headline and sourceKey for the same event+state", () => {
    const { state } = bootRegular("media_det", 21);
    const teamId = state.user.activeOwnerTeamId;
    const roster = state.world.teams[teamId]?.roster ?? [];
    const playerId = asPlayerId(roster[0] ?? "p_test");

    const event = createDomainEvent({
      type: "PlayerInjured",
      occurredOn: state.world.calendar.currentDate,
      payload: { playerId, teamId },
    });

    const a = generateHeadline(event, state);
    const b = generateHeadline(event, state);
    expect(a.headline).toBe(b.headline);
    expect(a.summary).toBe(b.summary);

    const sourceKey = toSourceKey({ type: "domain_event", id: event.id });
    const feedA = processMediaFromEvents(
      state,
      [event],
      { teamId },
      createEmptyMediaFeed(),
      createEmptySocialFeed(),
    );
    const feedB = processMediaFromEvents(
      state,
      [event],
      { teamId },
      createEmptyMediaFeed(),
      createEmptySocialFeed(),
    );

    expect(feedA.items[0]?.sourceKey).toBe(sourceKey);
    expect(feedB.items[0]?.sourceKey).toBe(sourceKey);
    expect(feedA.items[0]?.headline).toBe(feedB.items[0]?.headline);
    expect(feedA.items[0]?.id).toBe(feedB.items[0]?.id);
    expect(feedA.items[0]?.importance).toBe(feedB.items[0]?.importance);
  });

  it("dedupes by sourceKey when processing the same event twice", () => {
    const { state } = bootRegular("media_dedupe", 22);
    const teamId = state.user.activeOwnerTeamId;
    const otherTeamId = asTeamId(
      Object.keys(state.world.teams).find((id) => id !== teamId)!,
    );
    const event = createDomainEvent({
      type: "PlayerTraded",
      occurredOn: state.world.calendar.currentDate,
      payload: {
        fromTeamId: teamId,
        toTeamId: otherTeamId,
        playerIds: [],
      },
    });

    const first = processMediaFromEvents(
      state,
      [event],
      { teamId },
      createEmptyMediaFeed(),
      createEmptySocialFeed(),
    );
    expect(first.items.length).toBe(1);

    const second = processMediaFromEvents(
      state,
      [event],
      { teamId },
      first.mediaFeed,
      first.socialFeed,
    );
    expect(second.items.length).toBe(0);
    expect(second.mediaFeed.items.length).toBe(1);
  });

  it("runs derived projections after simulation without duplicating on re-process", () => {
    const { state, rng } = bootRegular("media_proj", 23);
    const result = advanceSimulation(state, rng, { days: 1 });
    const projected = processDerivedProjections(result.state, result.events);
    const franchise = getActiveOwnedFranchise(projected);
    const count = franchise.mediaFeed.items.length;

    const again = processDerivedProjections(projected, result.events);
    const franchise2 = getActiveOwnedFranchise(again);
    expect(franchise2.mediaFeed.items.length).toBe(count);
  });

  it("assigns higher relevance when the user team is involved", () => {
    const { state } = bootRegular("media_rel", 24);
    const teamId = state.user.activeOwnerTeamId;

    const ownEvent = createDomainEvent({
      type: "ContractSigned",
      occurredOn: state.world.calendar.currentDate,
      payload: { teamId, playerId: asPlayerId("p1") },
    });
    const unrelatedEvent = {
      ...createDomainEvent({
        type: "ContractSigned",
        occurredOn: state.world.calendar.currentDate,
        payload: {
          teamId: asTeamId("team_unrelated_zzz"),
          playerId: asPlayerId("p2"),
        },
      }),
      id: asDomainEventId("evt_other_contract"),
    };

    const own = processMediaFromEvents(
      state,
      [ownEvent],
      { teamId },
      createEmptyMediaFeed(),
      createEmptySocialFeed(),
    );
    const other = processMediaFromEvents(
      state,
      [unrelatedEvent],
      { teamId },
      createEmptyMediaFeed(),
      createEmptySocialFeed(),
    );

    expect(own.items[0]?.relevanceScore ?? 0).toBeGreaterThanOrEqual(40);
    expect(own.items[0]?.relevanceScore ?? 0).toBeGreaterThan(
      other.items[0]?.relevanceScore ?? 0,
    );
  });
});
