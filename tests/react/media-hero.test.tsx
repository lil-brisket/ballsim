import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  SHOWCASE_CONTEXT,
  SHOWCASE_POSTS,
} from "@/app/dev/media-showcase/sample-posts";
import {
  TopStoryHero,
  heroHeadline,
  heroTeamOf,
} from "@/components/media-hub/timeline/TopStoryHero";
import { contrastRatio } from "@/domain/color-contrast";
import { TEAM_INK_SURFACE } from "@/presentation/team-theme";
import type { TimelinePostView } from "@/state/media-timeline/post-view";

afterEach(cleanup);

function renderHero(post: TimelinePostView, context = SHOWCASE_CONTEXT) {
  return render(<TopStoryHero post={post} context={context} />);
}

describe("heroHeadline", () => {
  it("takes the first sentence and drops hashtags", () => {
    expect(
      heroHeadline("Rory Vance scored 41 in a win. Top of the class. #Lights"),
    ).toEqual({
      headline: "Rory Vance scored 41 in a win.",
      dek: "Top of the class.",
    });
    expect(heroHeadline("Swept. #Lights #HARvsSUM")).toEqual({
      headline: "Swept.",
      dek: null,
    });
  });
});

describe("TopStoryHero", () => {
  it("renders one top-story region with a small eyebrow, not a heading", () => {
    renderHero(SHOWCASE_POSTS[0]!);
    const region = screen.getByRole("region", { name: "Top story" });
    expect(within(region).getAllByRole("article")).toHaveLength(1);
    expect(within(region).queryAllByRole("heading")).toEqual([]);
    expect(within(region).getByText("Top story")).toBeTruthy();
  });

  it("renders a graphic for every attachment kind", () => {
    const kinds = new Set<string>();
    for (const post of SHOWCASE_POSTS) {
      const { container, unmount } = renderHero(post);
      kinds.add(post.attachment.type);
      const article = container.querySelector("article")!;
      expect(article.textContent).not.toMatch(/#\w/);
      expect(container.innerHTML).not.toContain("amber");
      expect(article.getAttribute("aria-labelledby")).toBeTruthy();
      unmount();
    }
    expect(kinds.size).toBeGreaterThanOrEqual(9);
  });

  it("shows the final score for a game and links the box score", () => {
    const game = SHOWCASE_POSTS.find(
      (p) => p.attachment.type === "game" && p.boxScoreHref,
    )!;
    const { container } = renderHero(game);
    expect(container.querySelector("[data-hero-score]")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Box score" }).getAttribute("href"),
    ).toBe(game.boxScoreHref);
  });

  it("shows a performance's numbers and a portrait in team uniform", () => {
    const perf = SHOWCASE_POSTS.find(
      (p) => p.attachment.type === "performance",
    )!;
    const { container } = renderHero(perf);
    const a = perf.attachment as Extract<
      TimelinePostView["attachment"],
      { type: "performance" }
    >;
    expect(screen.getByText(String(a.line.points))).toBeTruthy();
    const portrait = container.querySelector("[data-portrait-size='xl']");
    expect(portrait?.getAttribute("data-portrait-uniform")).toBe("team");
  });

  it("themes the hero by the lead team with readable ink for light, dark and neon teams", () => {
    for (const teamId of ["har", "sum", "neo"]) {
      const branding = SHOWCASE_CONTEXT.teams[teamId]!.branding!;
      const post = SHOWCASE_POSTS.find((p) => p.attachment.type === "streak")!;
      const attachment = {
        ...(post.attachment as Extract<
          TimelinePostView["attachment"],
          { type: "streak" }
        >),
      };
      attachment.team = { ...attachment.team, teamId };
      const { container, unmount } = renderHero({ ...post, attachment });
      expect(heroTeamOf(attachment)?.teamId).toBe(teamId);
      const scope = container.querySelector<HTMLElement>(
        "[style*='--team-ink']",
      )!;
      expect(scope.style.getPropertyValue("--team-primary").toLowerCase()).toBe(
        branding.primaryColor.toLowerCase(),
      );
      const ink = scope.style.getPropertyValue("--team-ink");
      expect(contrastRatio(ink, TEAM_INK_SURFACE) ?? 0).toBeGreaterThanOrEqual(
        4.5,
      );
      expect(container.querySelector("[data-hero-watermark]")).toBeTruthy();
      unmount();
    }
  });
});
