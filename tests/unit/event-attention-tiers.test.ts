import { describe, expect, it } from "vitest";
import {
  collectAttentionIndicators,
  getEventAttentionTier,
  groupEventsByAttentionTier,
} from "@/components/calendar/event-attention-tiers";
import type { CalendarEventView } from "@/domain/entities/calendar-event";
import { asGameId, asTeamId } from "@/domain/ids";

function event(
  partial: Partial<CalendarEventView> &
    Pick<CalendarEventView, "id" | "category">,
): CalendarEventView {
  return {
    date: "2026-09-09",
    lifecycle: "scheduled",
    title: partial.title ?? partial.category,
    importance: "medium",
    source: { type: "game", id: asGameId("game_test") },
    sourceKey: "game:game_test",
    blocking: false,
    completed: false,
    certainty: "scheduled",
    ...partial,
  };
}

describe("event-attention-tiers", () => {
  const userTeam = asTeamId("team_user");

  it("ranks user team games as tier 1", () => {
    const game = event({
      id: "g1",
      category: "game",
      teamIds: [userTeam],
    });
    expect(getEventAttentionTier(game, userTeam)).toBe(1);
  });

  it("ranks blocking decisions as tier 2", () => {
    const decision = event({
      id: "d1",
      category: "deadline",
      blocking: true,
      lifecycle: "action_required",
    });
    expect(getEventAttentionTier(decision, userTeam)).toBe(2);
  });

  it("collects indicators with team game preferred", () => {
    const events = [
      event({ id: "g1", category: "game", teamIds: [userTeam] }),
      event({ id: "n1", category: "news" }),
      event({ id: "i1", category: "injury", teamIds: [userTeam] }),
    ];
    const indicators = collectAttentionIndicators(events, userTeam);
    expect(indicators[0]).toBe("team_game");
    expect(indicators).toContain("user_impact");
  });

  it("groups by attention tier", () => {
    const groups = groupEventsByAttentionTier(
      [
        event({ id: "g1", category: "game", teamIds: [userTeam] }),
        event({ id: "l1", category: "league" }),
      ],
      userTeam,
    );
    expect(groups[0]?.tier).toBe(1);
  });
});
