import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AroundTheLeaguePanel } from "@/components/owner/dashboard/AroundTheLeaguePanel";
import type { TimelineHighlights } from "@/state/media-timeline/highlights";
import type { TimelinePostView } from "@/state/media-timeline/post-view";

afterEach(cleanup);

const branding = {
  primaryColor: "#1d4ed8",
  secondaryColor: "#facc15",
  accentColor: "#ffffff",
  logoId: "shield",
};

function post(): TimelinePostView {
  return {
    id: "p1",
    kind: "league",
    occurredOn: "2026-10-08",
    dateLabel: "Oct 8",
    relativeLabel: "2d",
    unread: true,
    author: {
      key: "fan:t1",
      kind: "fan",
      displayName: "Harbor Nest",
      handle: "@HarborNest",
      verified: false,
      teamId: "t1",
      playerId: null,
      beat: null,
      avatar: { type: "monogram", initials: "HN", teamId: "t1" },
    },
    text: "What a night.",
    tags: [],
    replies: [],
    engagement: { replies: 1, reposts: 1, likes: 1 },
    engagementDisplay: { replies: "1", reposts: "1", likes: "1" },
    engagementLabel: "1 replies, 1 reposts, 1 likes",
    attachment: { type: "league", headline: "h", summary: "s" },
    boxScoreHref: null,
  } as TimelinePostView;
}

function timeline(
  posts: TimelinePostView[],
  unreadCount: number,
): TimelineHighlights {
  return {
    posts,
    unreadCount,
    context: {
      saveId: "s1",
      teams: { t1: { branding, href: "/dashboard/s1/teams/t1" } },
      portraits: {},
    },
  };
}

describe("AroundTheLeaguePanel", () => {
  it("shows the lead stories and a Media Hub link with the unread count", () => {
    render(
      <AroundTheLeaguePanel saveId="s1" timeline={timeline([post()], 4)} />,
    );

    expect(screen.getByText("What a night.")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Media Hub/ }).getAttribute("href"),
    ).toBe("/dashboard/s1/media");
    expect(screen.getByText(/Media Hub · 4 unread/)).toBeTruthy();
  });

  it("omits the unread count when everything is read", () => {
    render(
      <AroundTheLeaguePanel saveId="s1" timeline={timeline([post()], 0)} />,
    );

    expect(screen.queryByText(/unread/)).toBeNull();
  });

  it("falls back to a message when there are no stories", () => {
    render(<AroundTheLeaguePanel saveId="s1" timeline={timeline([], 0)} />);

    expect(screen.getByText(/No league stories yet/)).toBeTruthy();
  });
});
