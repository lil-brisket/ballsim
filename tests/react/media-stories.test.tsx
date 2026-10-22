import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MediaStoriesStrip } from "@/components/media-hub/stories/MediaStoriesStrip";
import {
  resetStoriesSeenForTests,
  StoriesViewer,
  type StoryViewerRing,
} from "@/components/media-hub/stories/StoriesViewer";
import { resetDrawerScrollLockForTests } from "@/components/ui/drawer-scroll-lock";
import {
  SHOWCASE_CONTEXT,
  SHOWCASE_POSTS,
} from "@/app/dev/media-showcase/sample-posts";

const SAVE = "save-1";
const KEY = `ballsim:media-stories:${SAVE}`;

function rings(): StoryViewerRing[] {
  return [
    {
      key: "last-night",
      label: "Last night",
      latestOn: "2026-10-20",
      slideCount: 3,
      slides: ["slide A1", "slide A2", "slide A3"],
      media: null,
      mediaKind: "logo",
    },
    {
      key: "awards",
      label: "Awards",
      latestOn: "2026-10-18",
      slideCount: 2,
      slides: ["slide B1", "slide B2"],
      media: null,
      mediaKind: "trophy",
    },
    {
      key: "trade-wire",
      label: "Trades",
      latestOn: "2026-10-18",
      slideCount: 0,
      slides: [],
      media: null,
      mediaKind: "logo",
    },
  ];
}

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes("reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const position = () => screen.getByTestId("story-position").textContent;

describe("StoriesViewer", () => {
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

  it("renders one named button per non-empty ring", () => {
    render(<StoriesViewer saveId={SAVE} rings={rings()} />);
    expect(screen.getByLabelText("Stories")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Last night, 3 posts, new" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Awards, 2 posts, new" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Trades/ })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("opens a labelled dialog and steps with keys and buttons", () => {
    render(<StoriesViewer saveId={SAVE} rings={rings()} />);
    fireEvent.click(screen.getByRole("button", { name: /Last night/ }));
    const dialog = screen.getByRole("dialog", { name: "Last night" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(position()).toBe("1 of 3");
    expect(screen.getByText("slide A1")).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(position()).toBe("2 of 3");
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(position()).toBe("1 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Next story" }));
    expect(position()).toBe("2 of 3");
    fireEvent.click(screen.getByRole("button", { name: "Previous story" }));
    expect(position()).toBe("1 of 3");
  });

  it("closes on Escape, restores focus and unlocks scroll", () => {
    vi.useFakeTimers();
    render(<StoriesViewer saveId={SAVE} rings={rings()} />);
    const button = screen.getByRole("button", { name: /Last night/ });
    button.focus();
    fireEvent.click(button);
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(document.body.style.overflow).not.toBe("hidden");
  });

  it("traps Tab inside the dialog", () => {
    render(<StoriesViewer saveId={SAVE} rings={rings()} />);
    fireEvent.click(screen.getByRole("button", { name: /Last night/ }));
    const dialog = screen.getByRole("dialog");
    const buttons = Array.from(dialog.querySelectorAll("button")).filter(
      (b) => b.tabIndex !== -1 && !b.disabled,
    );
    const last = buttons[buttons.length - 1]!;
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("marks a ring seen and stores the date", () => {
    render(<StoriesViewer saveId={SAVE} rings={rings()} />);
    fireEvent.click(screen.getByRole("button", { name: /Last night/ }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(
      screen.getByRole("button", { name: "Last night, 3 posts, seen" }),
    ).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({
      "last-night": "2026-10-20",
    });
  });

  it("treats a ring newer than the stored date as new", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ "last-night": "2026-10-19", awards: "2026-10-18" }),
    );
    render(<StoriesViewer saveId={SAVE} rings={rings()} />);
    expect(
      screen.getByRole("button", { name: "Last night, 3 posts, new" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Awards, 2 posts, seen" }),
    ).toBeTruthy();
  });

  it("does not crash when localStorage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    render(<StoriesViewer saveId={SAVE} rings={rings()} />);
    fireEvent.click(screen.getByRole("button", { name: /Last night/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("auto-advances after about 5 seconds", () => {
    vi.useFakeTimers();
    render(<StoriesViewer saveId={SAVE} rings={rings()} />);
    fireEvent.click(screen.getByRole("button", { name: /Last night/ }));
    act(() => {
      vi.advanceTimersByTime(4900);
    });
    expect(position()).toBe("1 of 3");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(position()).toBe("2 of 3");
  });

  it("pauses auto-advance while hovered", () => {
    vi.useFakeTimers();
    render(<StoriesViewer saveId={SAVE} rings={rings()} />);
    fireEvent.click(screen.getByRole("button", { name: /Last night/ }));
    fireEvent.mouseEnter(screen.getByRole("dialog"));
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    expect(position()).toBe("1 of 3");
  });

  it("resumes with the time left on the slide, not a fresh 5 seconds", () => {
    vi.useFakeTimers();
    render(<StoriesViewer saveId={SAVE} rings={rings()} />);
    fireEvent.click(screen.getByRole("button", { name: /Last night/ }));
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const dialog = screen.getByRole("dialog");
    fireEvent.mouseEnter(dialog);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    fireEvent.mouseLeave(dialog);
    act(() => {
      vi.advanceTimersByTime(1900);
    });
    expect(position()).toBe("1 of 3");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(position()).toBe("2 of 3");
    // The next slide gets the full time again.
    act(() => {
      vi.advanceTimersByTime(4900);
    });
    expect(position()).toBe("2 of 3");
  });

  it("does not auto-advance under reduced motion", () => {
    vi.useFakeTimers();
    mockMatchMedia(true);
    render(<StoriesViewer saveId={SAVE} rings={rings()} />);
    fireEvent.click(screen.getByRole("button", { name: /Last night/ }));
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(position()).toBe("1 of 3");
    const segments = screen
      .getByRole("dialog")
      .querySelectorAll("[data-segment]");
    expect(segments).toHaveLength(3);
    expect(segments[0]!.querySelector("[style*=animation]")).toBeNull();
  });

  it("moves into the next ring after the last slide, then closes", () => {
    render(<StoriesViewer saveId={SAVE} rings={rings()} />);
    fireEvent.click(screen.getByRole("button", { name: /Last night/ }));
    const next = () => fireEvent.keyDown(document, { key: "ArrowRight" });
    next();
    next();
    expect(position()).toBe("3 of 3");
    next();
    expect(screen.getByRole("dialog", { name: "Awards" })).toBeTruthy();
    expect(position()).toBe("1 of 2");
    next();
    next();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual({
      "last-night": "2026-10-20",
      awards: "2026-10-18",
    });
  });
});

describe("MediaStoriesStrip", () => {
  it("server-renders ring buttons and nothing when empty", () => {
    const html = renderToStaticMarkup(
      <MediaStoriesStrip
        saveId={SAVE}
        context={SHOWCASE_CONTEXT}
        rings={[
          {
            key: "last-night",
            label: "Last night",
            latestOn: "2026-10-20",
            slides: SHOWCASE_POSTS.slice(0, 2),
          },
          { key: "awards", label: "Awards", latestOn: "x", slides: [] },
        ]}
      />,
    );
    expect(html).toContain('aria-label="Stories"');
    expect(html).toContain("Last night, 2 posts, new");
    expect(html).not.toContain("Awards");
    expect(html).not.toContain('role="dialog"');
    expect(
      renderToStaticMarkup(
        <MediaStoriesStrip
          saveId={SAVE}
          context={SHOWCASE_CONTEXT}
          rings={[]}
        />,
      ),
    ).toBe("");
  });
});
