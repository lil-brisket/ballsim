import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LeagueAttachmentCard } from "@/components/media-hub/timeline/LeagueAttachmentCard";
import {
  TimelineFeed,
  TimelineLoadMore,
} from "@/components/media-hub/timeline/TimelineFeed";
import {
  TimelinePostShell,
  isBigMoment,
} from "@/components/media-hub/timeline/TimelinePostShell";
import type { TimelineAccount } from "@/state/media-timeline/accounts";
import type {
  TimelineDisplayContext,
  TimelinePostView,
} from "@/state/media-timeline/post-view";

afterEach(cleanup);

const branding = {
  primaryColor: "#1d4ed8",
  secondaryColor: "#facc15",
  accentColor: "#ffffff",
  logoId: "shield",
};

const context: TimelineDisplayContext = {
  saveId: "save-1",
  teams: { t1: { branding, href: "/dashboard/save-1/teams/t1" } },
  portraits: {},
};

function account(overrides: Partial<TimelineAccount> = {}): TimelineAccount {
  return {
    key: "fan:t1",
    kind: "fan",
    displayName: "Harbor Nest",
    handle: "@HarborNest",
    verified: false,
    teamId: "t1",
    playerId: null,
    beat: null,
    avatar: { type: "monogram", initials: "HN", teamId: "t1" },
    ...overrides,
  };
}

function post(overrides: Partial<TimelinePostView> = {}): TimelinePostView {
  return {
    id: "p1",
    kind: "league",
    occurredOn: "2026-10-08",
    dateLabel: "Oct 8",
    relativeLabel: "2d",
    unread: false,
    author: account({ verified: true }),
    text: "What a night.",
    replies: [],
    engagement: { replies: 214, reposts: 1200, likes: 5800 },
    engagementDisplay: { replies: "214", reposts: "1.2K", likes: "5.8K" },
    engagementLabel: "214 replies, 1.2K reposts, 5.8K likes",
    attachment: { type: "league", headline: "h", summary: "s" },
    boxScoreHref: null,
    ...overrides,
  } as TimelinePostView;
}

describe("TimelinePostShell", () => {
  it("labels the article by the author name", () => {
    render(<TimelinePostShell post={post()} context={context} />);
    expect(screen.getByRole("article", { name: "Harbor Nest" })).toBeTruthy();
  });

  it("renders a time element with dateTime and the relative label", () => {
    const { container } = render(
      <TimelinePostShell post={post()} context={context} />,
    );
    const time = container.querySelector("time")!;
    expect(time.getAttribute("datetime")).toBe("2026-10-08");
    expect(time.getAttribute("title")).toBe("Oct 8");
    expect(time.textContent).toBe("2d");
  });

  it("hides the avatar from assistive tech", () => {
    const { container } = render(
      <TimelinePostShell post={post()} context={context} />,
    );
    const avatar = container.querySelector("article > span[aria-hidden]")!;
    expect(avatar.getAttribute("aria-hidden")).toBe("true");
    expect(avatar.textContent).toBe("HN");
  });

  it("labels the engagement row", () => {
    render(<TimelinePostShell post={post()} context={context} />);
    const group = screen.getByRole("group");
    expect(group.getAttribute("aria-label")).toBe(
      "214 replies, 1.2K reposts, 5.8K likes",
    );
    expect(
      group.querySelectorAll("[aria-hidden='true'].tabular-nums"),
    ).toHaveLength(3);
  });

  it("shows the Verified and Unread text only when applicable", () => {
    const { rerender } = render(
      <TimelinePostShell post={post({ unread: true })} context={context} />,
    );
    expect(screen.getByText("Unread")).toBeTruthy();
    expect(screen.getByText("Verified")).toBeTruthy();
    rerender(
      <TimelinePostShell
        post={post({ author: account({ verified: false }) })}
        context={context}
      />,
    );
    expect(screen.queryByText("Unread")).toBeNull();
    expect(screen.queryByText("Verified")).toBeNull();
  });

  it("renders replies in a details element with a count summary", () => {
    const replies = [
      { id: "p1:reply:0", author: account(), text: "First!" },
      { id: "p1:reply:1", author: account(), text: "Second." },
    ];
    const { container, rerender } = render(
      <TimelinePostShell post={post({ replies })} context={context} />,
    );
    const details = container.querySelector("details")!;
    expect(details.querySelector("summary")!.textContent).toBe(
      "Show 2 replies",
    );
    expect(details.textContent).toContain("Second.");
    rerender(
      <TimelinePostShell
        post={post({ replies: replies.slice(0, 1) })}
        context={context}
      />,
    );
    expect(container.querySelector("summary")!.textContent).toBe(
      "Show 1 reply",
    );
  });

  it("renders no details without replies", () => {
    const { container } = render(
      <TimelinePostShell post={post()} context={context} />,
    );
    expect(container.querySelector("details")).toBeNull();
  });

  it("renders children and never uses mono", () => {
    const { container } = render(
      <TimelinePostShell post={post({ unread: true })} context={context}>
        <LeagueAttachmentCard
          attachment={{ type: "league", headline: "h", summary: "Summary" }}
        />
      </TimelinePostShell>,
    );
    expect(screen.getByText("Summary")).toBeTruthy();
    expect(container.querySelector(".font-mono")).toBeNull();
  });
});

describe("feed atmosphere", () => {
  const ref = {
    teamId: "t1",
    abbreviation: "HAR",
    displayName: "Harbor Lights",
    name: "Lights",
    branding: null,
  };
  const line = {
    minutes: 38,
    points: 50,
    rebounds: 9,
    assists: 6,
    steals: 1,
    blocks: 0,
    fieldGoalsMade: 18,
    fieldGoalsAttempted: 30,
    threePointersMade: 5,
    threePointersAttempted: 11,
  };
  const performance = (points: number) =>
    post({
      kind: "performance",
      attachment: {
        type: "performance",
        gameId: "g1",
        player: {
          playerId: "p9",
          firstName: "Teo",
          lastName: "Valdane",
          teamId: "t1",
        },
        team: ref,
        opponent: { ...ref, teamId: "t2" },
        won: true,
        line: { ...line, points },
        reasons: [],
      },
    });
  const playoff = (event: "champion" | "series_won") =>
    post({
      kind: "playoff",
      attachment: {
        type: "playoff",
        event,
        seasonYear: 2026,
        seriesId: "s1",
        roundLabel: "Finals",
        winner: ref,
        loser: null,
        seriesScore: null,
        sweep: false,
        wentDistance: false,
      },
    });

  it("calls champions and 50-point games big moments, nothing else", () => {
    expect(isBigMoment(performance(50))).toBe(true);
    expect(isBigMoment(performance(49))).toBe(false);
    expect(isBigMoment(playoff("champion"))).toBe(true);
    expect(isBigMoment(playoff("series_won"))).toBe(false);
    expect(isBigMoment(post())).toBe(false);
  });

  it("marks big moments and new posts, but never compact copies", () => {
    const { container, rerender } = render(
      <TimelinePostShell
        post={{ ...playoff("champion"), unread: true }}
        context={context}
      />,
    );
    const article = () => container.querySelector("article")!;
    expect(article().hasAttribute("data-big-moment")).toBe(true);
    expect(article().hasAttribute("data-new-post")).toBe(true);
    rerender(
      <TimelinePostShell
        post={{ ...playoff("champion"), unread: true }}
        context={context}
        compact
      />,
    );
    expect(article().hasAttribute("data-big-moment")).toBe(false);
    expect(article().hasAttribute("data-new-post")).toBe(false);
    rerender(<TimelinePostShell post={post()} context={context} />);
    expect(article().hasAttribute("data-new-post")).toBe(false);
  });
});

describe("TimelineFeed", () => {
  it("is a labelled feed", () => {
    render(
      <TimelineFeed>
        <TimelinePostShell post={post()} context={context} />
      </TimelineFeed>,
    );
    const feed = screen.getByRole("feed", { name: "League timeline" });
    expect(feed.getAttribute("aria-busy")).toBe("false");
  });

  it("renders Load more as a link only when href is set", () => {
    const { rerender } = render(<TimelineLoadMore href="?before=abc" />);
    const link = screen.getByRole("link", { name: "Load more" });
    expect(link.getAttribute("href")).toBe("?before=abc");
    rerender(<TimelineLoadMore href={null} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
