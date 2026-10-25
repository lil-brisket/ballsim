import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import MediaShowcasePage from "@/app/dev/media-showcase/page";
import {
  SHOWCASE_CONTEXT,
  SHOWCASE_POSTS,
} from "@/app/dev/media-showcase/sample-posts";
import {
  TimelineAttachmentCard,
  TimelinePost,
} from "@/components/media-hub/timeline/TimelinePost";
import type { TimelinePostView } from "@/state/media-timeline/post-view";

afterEach(cleanup);

function byId(id: string): TimelinePostView {
  const found = SHOWCASE_POSTS.find((post) => post.id === id);
  if (!found) throw new Error(`missing sample post ${id}`);
  return found;
}

describe("media showcase page", () => {
  it("renders one article per sample post inside a feed, plus 3 heroes and 3 compact", () => {
    render(<MediaShowcasePage />);
    const feed = screen.getByRole("feed");
    expect(within(feed).getAllByRole("article")).toHaveLength(
      SHOWCASE_POSTS.length,
    );
    expect(screen.getAllByRole("region", { name: "Top story" })).toHaveLength(
      3,
    );
    expect(screen.getAllByRole("article")).toHaveLength(
      SHOWCASE_POSTS.length + 3 + 3,
    );
    expect(screen.getByRole("link", { name: "Load more" })).toBeTruthy();
  });

  it("has exactly one h1", () => {
    render(<MediaShowcasePage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("covers every attachment type and author kind", () => {
    expect(new Set(SHOWCASE_POSTS.map((p) => p.attachment.type))).toEqual(
      new Set([
        "game",
        "performance",
        "award",
        "award_race",
        "playoff",
        "streak",
        "trade",
        "signing",
        "injury",
        "league",
      ]),
    );
    expect(new Set(SHOWCASE_POSTS.map((p) => p.author.kind))).toEqual(
      new Set(["league", "team", "reporter", "analyst", "fan", "player"]),
    );
  });

  it("renders a recognisable marker for each attachment type", () => {
    render(<MediaShowcasePage />);
    const feed = within(screen.getByRole("feed"));
    // game: line score and series state
    expect(feed.getAllByText("2OT").length).toBeGreaterThan(0);
    expect(feed.getByText("HAR leads 3–2")).toBeTruthy();
    expect(feed.getAllByRole("link", { name: "Box score" }).length).toBe(2);
    // performance
    expect(feed.getAllByText("Season high").length).toBeGreaterThan(0);
    // award
    expect(feed.getByText("Most Valuable Player")).toBeTruthy();
    expect(feed.getByText("Dale Whitcombe")).toBeTruthy();
    // award race
    expect(feed.getByText("Defensive Player of the Year race")).toBeTruthy();
    expect(feed.getByText("Previous leader: Imani Strand")).toBeTruthy();
    // playoff
    expect(feed.getByText("Champions")).toBeTruthy();
    expect(feed.getByText("Sweep")).toBeTruthy();
    expect(feed.getByText("Game 7")).toBeTruthy();
    expect(feed.getByText("2025–26 champions")).toBeTruthy();
    // streak
    expect(feed.getByText("straight wins")).toBeTruthy();
    expect(feed.getByText("straight losses")).toBeTruthy();
    expect(feed.getByText("game win streak snapped")).toBeTruthy();
    // trade
    expect(feed.getAllByText("Receives")).toHaveLength(2);
    expect(feed.getByText("2027 second-round pick to Harbor")).toBeTruthy();
    // signing
    expect(
      feed.getByText(
        "Ravi Okafor signs a 2-year deal with the Lakeshore Tides.",
      ),
    ).toBeTruthy();
    // injury
    expect(feed.getByText("Knee")).toBeTruthy();
    expect(feed.getByText(/Expected back/)).toBeTruthy();
    // league
    expect(
      feed.getByText("Two games have been moved to a later date."),
    ).toBeTruthy();
  });
});

describe("TimelineAttachmentCard", () => {
  it("omits the league card when the post text contains the summary", () => {
    const { container } = render(
      <TimelineAttachmentCard
        post={byId("showcase-league-text-only")}
        context={SHOWCASE_CONTEXT}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows the league card when the text does not contain the summary", () => {
    render(
      <TimelineAttachmentCard
        post={byId("showcase-league-card")}
        context={SHOWCASE_CONTEXT}
      />,
    );
    expect(
      screen.getByText("Two games have been moved to a later date."),
    ).toBeTruthy();
  });

  it("renders no attachment card for compact posts", () => {
    render(
      <TimelinePost
        post={byId("showcase-streak-win")}
        context={SHOWCASE_CONTEXT}
        compact
      />,
    );
    expect(screen.getByRole("article")).toBeTruthy();
    expect(screen.queryByText("straight wins")).toBeNull();
  });
});
