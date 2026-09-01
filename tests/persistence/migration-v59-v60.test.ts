import { describe, expect, it } from "vitest";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { createTestGameState } from "../factories/game-state";

describe("v59 → v60 migration", () => {
  it("initializes empty mediaFeed, socialFeed, and mediaReadState", () => {
    const modern = createTestGameState({ saveId: "mig_v60" });
    const parsed = JSON.parse(serializeGameState(modern)) as Record<
      string,
      unknown
    >;
    (parsed.meta as Record<string, unknown>).schemaVersion = 59;

    const user = parsed.user as {
      ownedFranchises: Record<string, Record<string, unknown>>;
    };
    for (const franchise of Object.values(user.ownedFranchises)) {
      delete franchise.mediaFeed;
      delete franchise.socialFeed;
      delete franchise.mediaReadState;
    }

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(GAME_STATE_SCHEMA_VERSION).toBe(60);

    for (const franchise of Object.values(loaded.user.ownedFranchises)) {
      expect(franchise.mediaFeed).toEqual({ items: [] });
      expect(franchise.socialFeed).toEqual({ posts: [] });
      expect(franchise.mediaReadState).toEqual({});
    }
    expect(() => validateGameState(loaded)).not.toThrow();
  });

  it("round-trips a v60 save with media feed data", () => {
    const state = createTestGameState({ saveId: "mig_v60_rt" });
    const teamId = state.user.activeOwnerTeamId;
    const withMedia = {
      ...state,
      user: {
        ...state.user,
        ownedFranchises: {
          ...state.user.ownedFranchises,
          [teamId]: {
            ...state.user.ownedFranchises[teamId],
            mediaFeed: {
              items: [
                {
                  id: "media_domain_event:evt_test",
                  source: { type: "domain_event" as const, id: "evt_test" },
                  sourceKey: "domain_event:evt_test",
                  occurredOn: state.world.calendar.currentDate,
                  storyType: "transaction" as const,
                  importance: "high" as const,
                  relevanceScore: 40,
                  headline: "Test trade",
                  summary: "A test trade story.",
                  status: "confirmed" as const,
                  href: "/media/domain_event:evt_test",
                },
              ],
            },
            mediaReadState: {
              "media_domain_event:evt_test": {
                readAt: state.world.calendar.currentDate,
              },
            },
          },
        },
      },
    };

    const roundTrip = deserializeGameState(serializeGameState(withMedia));
    const franchise = roundTrip.user.ownedFranchises[teamId];
    expect(franchise.mediaFeed.items).toHaveLength(1);
    expect(franchise.mediaFeed.items[0]?.headline).toBe("Test trade");
    expect(franchise.mediaReadState["media_domain_event:evt_test"]?.readAt).toBe(
      state.world.calendar.currentDate,
    );
    expect(() => validateGameState(roundTrip)).not.toThrow();
  });
});
