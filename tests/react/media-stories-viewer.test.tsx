import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SHOWCASE_CONTEXT,
  SHOWCASE_POSTS,
} from "@/app/dev/media-showcase/sample-posts";
import { MediaStoriesStrip } from "@/components/media-hub/stories/MediaStoriesStrip";
import { resetStoriesSeenForTests } from "@/components/media-hub/stories/StoriesViewer";
import { resetDrawerScrollLockForTests } from "@/components/ui/drawer-scroll-lock";
import type { TimelinePostView } from "@/state/media-timeline/post-view";

const SAVE = "save-1";

function byType(type: string): TimelinePostView[] {
  return SHOWCASE_POSTS.filter((post) => post.attachment.type === type);
}

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function renderStrip() {
  const awardWithoutWinner = byType("award").find(
    (post) =>
      post.attachment.type === "award" && post.attachment.winner === null,
  );
  const rings = [
    {
      key: "last-night",
      label: "Last night",
      latestOn: "2026-10-20",
      slides: byType("game").slice(0, 3),
    },
    {
      key: "top-performers",
      label: "Top players",
      latestOn: "2026-10-20",
      slides: byType("performance").slice(0, 1),
    },
    {
      key: "awards",
      label: "Awards",
      latestOn: "2026-10-20",
      slides: awardWithoutWinner ? [awardWithoutWinner] : byType("award"),
    },
  ];
  return render(
    <MediaStoriesStrip
      saveId={SAVE}
      context={SHOWCASE_CONTEXT}
      rings={rings}
    />,
  );
}

const position = () => screen.getByTestId("story-position").textContent;
const open = (name: RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));

describe("story viewer", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStoriesSeenForTests();
    resetDrawerScrollLockForTests();
    mockMatchMedia(false);
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetDrawerScrollLockForTests();
  });

  it("draws a portrait, logo or trophy in each ring instead of a glyph", () => {
    renderStrip();
    const kinds = Array.from(
      document.querySelectorAll("[data-ring-media]"),
    ).map((node) => node.getAttribute("data-ring-media"));
    expect(kinds).toEqual(["logo", "portrait", expect.stringMatching(/./)]);
    const performance = screen.getByRole("button", { name: /Top players/ });
    expect(performance.querySelector("[data-portrait-player-id]")).toBeTruthy();
  });

  it("moves between slides with the arrow keys and the tap zones", () => {
    renderStrip();
    open(/Last night/);
    expect(position()).toBe("1 of 3");
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(position()).toBe("2 of 3");
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(position()).toBe("1 of 3");
    fireEvent.click(screen.getByTestId("story-tap-next"));
    expect(position()).toBe("2 of 3");
    fireEvent.click(screen.getByTestId("story-tap-previous"));
    expect(position()).toBe("1 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Next story" }));
    expect(position()).toBe("2 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Previous story" }));
    expect(position()).toBe("1 of 3");
  });

  it("disables Previous on the first story", () => {
    renderStrip();
    open(/Last night/);
    expect(
      (
        screen.getByRole("button", {
          name: "Previous story",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("closes on Escape and returns focus to the ring", () => {
    vi.useFakeTimers();
    renderStrip();
    const ring = screen.getByRole("button", { name: /Last night/ });
    ring.focus();
    fireEvent.click(ring);
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(ring);
  });

  it("keeps Tab inside the dialog", () => {
    renderStrip();
    open(/Last night/);
    const dialog = screen.getByRole("dialog");
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]):not([tabindex="-1"])',
      ),
    );
    const last = focusable[focusable.length - 1]!;
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(focusable[0]);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("slides carry no engagement row, replies or post shell", () => {
    renderStrip();
    open(/Last night/);
    const slide = screen.getByTestId("story-slide");
    expect(slide.querySelector("article")).toBeNull();
    expect(slide.textContent).not.toMatch(/repl(y|ies)|repost|like/i);
  });

  it("links Open post to the post's anchor in the feed", () => {
    renderStrip();
    open(/Last night/);
    const link = screen.getByRole("link", { name: "Open post" });
    expect(link.getAttribute("href")).toMatch(
      new RegExp(`^/dashboard/${SAVE}/media#post-`),
    );
  });

  it("does not auto-advance or animate under reduced motion", () => {
    vi.useFakeTimers();
    mockMatchMedia(true);
    renderStrip();
    open(/Last night/);
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(position()).toBe("1 of 3");
    const active = screen
      .getByRole("dialog")
      .querySelector('[data-segment="active"]')!;
    expect(active.querySelector("[style*=animation]")).toBeNull();
    expect(active.querySelector(".bg-team-ink")).toBeTruthy();
  });

  it("fills the active segment over the slide time otherwise", () => {
    renderStrip();
    open(/Last night/);
    const active = screen
      .getByRole("dialog")
      .querySelector('[data-segment="active"]')!;
    expect(active.querySelector("[style*=animation]")).toBeTruthy();
  });
});
