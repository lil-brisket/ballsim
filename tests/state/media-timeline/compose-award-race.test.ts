import { describe, expect, it } from "vitest";
import { buildLeagueCast } from "@/state/media-timeline/accounts";
import {
  composePost,
  composeTimeline,
  renderTemplateVariants,
} from "@/state/media-timeline/compose-post";
import { createRefResolver } from "@/state/media-timeline/refs";
import type {
  AwardRaceAttachment,
  TimelinePost,
} from "@/state/media-timeline/types";
import { otherTeams, timelineState } from "./fixtures";

const state = timelineState();
const [teamA, teamB, teamC] = otherTeams(state);
const refs = createRefResolver(state);

function contender(rank: number, first: string, last: string, teamId: string) {
  return {
    rank,
    player: { playerId: `p${rank}`, firstName: first, lastName: last, teamId },
    coachName: null,
    team: refs.team(teamId),
  };
}

function racePost(previousLeaderName: string | null): TimelinePost {
  const attachment: AwardRaceAttachment = {
    type: "award_race",
    awardId: "mvp",
    awardName: "Most Valuable Player",
    seasonYear: 2026,
    throughDate: "2026-01-11",
    contenders: [
      contender(1, "Ada", "Racer", teamA!),
      contender(2, "Bo", "Chaser", teamB!),
      contender(3, "Cy", "Third", teamC!),
      contender(4, "Di", "Fourth", teamA!),
    ],
    previousLeaderName,
  };
  return {
    id: "award-race:s:mvp:2026-01-11",
    occurredOn: "2026-01-12",
    kind: "award",
    importance: "medium",
    notability: 55,
    relevance: 0,
    teamIds: [teamA!, teamB!, teamC!],
    playerIds: ["p1", "p2", "p3", "p4"],
    attachment,
    tags: ["Most Valuable Player", "Award Race"],
    unread: false,
  };
}

describe("award race text", () => {
  const cast = buildLeagueCast(state);
  const author = cast.league;

  it("lists the top three with team abbreviations and the week", () => {
    const texts = renderTemplateVariants(racePost(null), author).map(
      (v) => v.text,
    );
    const ladder = texts.find((t) => t.startsWith("MVP ladder"))!;
    expect(ladder).toContain("week ending Jan 11");
    expect(ladder).toContain(
      `1. Ada Racer (${refs.team(teamA!).abbreviation})`,
    );
    expect(ladder).toContain("3. Cy Third");
    expect(ladder).not.toContain("Di Fourth");
    expect(texts.some((t) => t.includes("takes over"))).toBe(false);
  });

  it("mentions a leader change only when there is one", () => {
    const texts = renderTemplateVariants(racePost("Zed Old"), author).map(
      (v) => v.text,
    );
    expect(texts.some((t) => t.includes("Zed Old"))).toBe(true);
    const unchanged = renderTemplateVariants(racePost(null), author);
    expect(unchanged.some((v) => v.text.includes("Zed Old"))).toBe(false);
  });

  it("composes under the league account", () => {
    const post = racePost("Zed Old");
    const composed = composePost(state, cast, post);
    expect(composed.authorKey).toBe(author.key);
    expect(composed.text).toMatch(/MVP|Zed Old/);
    expect(composeTimeline(state, [post])).toHaveLength(1);
  });
});
