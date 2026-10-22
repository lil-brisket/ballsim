import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/persistence/save-game-repository", () => ({
  prismaSaveGameStore: {
    list: vi.fn(),
    create: vi.fn(),
    load: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

import {
  advanceOwnerTime,
  loadCalendarPageView,
  loadMediaPageView,
  markAllMediaRead,
} from "@/application/game-service";
import { addCalendarDays } from "@/domain/calendar-date";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { resetDomainEventSequenceForTests } from "@/domain/events/domain-event";
import { createSeededRng } from "@/domain/rng";
import { createMemorySaveGameStore } from "@/persistence/memory-save-game-store";
import { createInitialGameState } from "@/state/create-initial-state";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { bootstrapWorld } from "@/systems/world-pipeline";

async function seedPlayedSave(id: string) {
  resetDomainEventSequenceForTests();
  const store = createMemorySaveGameStore();
  let state = createInitialGameState({
    saveId: id,
    rngSeed: 41,
    settings: CBL_GAME_SETTINGS,
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  state = beginRegularSeasonFromPreseason(state).state;
  state = { ...state, meta: { ...state.meta, rngState: rng.getState() } };
  await store.create({ id, name: id, state });
  const advanced = await advanceOwnerTime(
    id,
    {
      targetDate: addCalendarDays(state.world.calendar.currentDate, 6),
      stopOnPhaseChange: false,
    },
    store,
  );
  expect(advanced.ok).toBe(true);
  return store;
}

describe("Media Hub page view", () => {
  it("returns null for a missing save", async () => {
    const store = createMemorySaveGameStore();
    expect(await loadMediaPageView("missing", {}, store)).toBeNull();
  });

  it("maps old ?tab= links onto the new filters", async () => {
    const store = await seedPlayedSave("media_tabs");
    const view = await loadMediaPageView("media_tabs", { tab: "games" }, store);
    expect(view?.filter).toBe("scores");
  });

  it("marks every unread timeline post read", async () => {
    const store = await seedPlayedSave("media_read");
    const before = await loadMediaPageView("media_read", {}, store);
    expect(before!.unreadCount).toBeGreaterThan(0);

    const result = await markAllMediaRead("media_read", store);
    expect(result.ok).toBe(true);

    const after = await loadMediaPageView("media_read", {}, store);
    expect(after!.unreadCount).toBe(0);
    expect(after!.posts.every((post) => !post.unread)).toBe(true);
    const saved = (await store.load("media_read"))!.state;
    const franchise = saved.user.ownedFranchises[saved.user.activeOwnerTeamId]!;
    // The persisted feed the nav badge counts is cleared too.
    expect(
      franchise.mediaFeed.items.every(
        (item) => franchise.mediaReadState[item.id]?.readAt,
      ),
    ).toBe(true);
  });

  it("puts the top story in the calendar's simulation summary", async () => {
    const store = await seedPlayedSave("media_summary");
    const calendar = await loadCalendarPageView(
      "media_summary",
      { daysAdvanced: 6 },
      store,
    );
    const media = await loadMediaPageView("media_summary", {}, store);
    expect(calendar!.aroundTheLeague).toEqual({
      authorName: media!.topStory!.author.displayName,
      text: media!.topStory!.text,
      href: "/dashboard/media_summary/media",
    });
    const quiet = await loadCalendarPageView("media_summary", {}, store);
    expect(quiet!.aroundTheLeague).toBeNull();
  });
});
