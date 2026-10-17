import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FullCourtLines } from "@/components/game/court/FullCourtLines";
import { FullCourtView } from "@/components/game/watch/court/FullCourtView";
import {
  TRANSITION_MS,
  fullCourtBallMotion,
  pct,
} from "@/components/game/watch/court/court-motion";
import {
  COURT_AWAY,
  COURT_FIXTURE_VIEW,
  COURT_HOME,
} from "@/app/dev/broadcast-ui/court-fixture";
import { buildCourtPalette, tokenOutline } from "@/state/court-palette";
import { buildLiveBoxScore } from "@/state/watch-game-selectors";
import { buildFullCourtFrame } from "@/state/watch-full-court";
import type { WatchTeam } from "@/state/watch-game-view";

const VIEW = COURT_FIXTURE_VIEW;

function mockMatchMedia(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduce,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
}

function court(
  revealed: number,
  extra: Partial<Parameters<typeof FullCourtView>[0]> = {},
) {
  return (
    <FullCourtView
      frame={buildFullCourtFrame(VIEW, revealed)}
      home={COURT_HOME}
      away={COURT_AWAY}
      live={buildLiveBoxScore(VIEW, revealed)}
      players={VIEW.players}
      {...extra}
    />
  );
}

const originalMatchMedia = window.matchMedia;
const originalAnimate = Element.prototype.animate;

beforeEach(() => {
  mockMatchMedia(false);
});

afterEach(() => {
  cleanup();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: originalMatchMedia,
  });
  Element.prototype.animate = originalAnimate;
});

describe("FullCourtView", () => {
  it("renders ten tokens named like the half court", () => {
    render(court(1));
    expect(screen.getAllByTestId("court-token")).toHaveLength(10);
    expect(
      screen.getByRole("button", {
        name: /^Kai Lee, Harbor Harriers, 0 pts$/,
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^Jalen Smith, .*, 3 pts/ }),
    ).toBeTruthy();
  });

  it("labels the group with the home floor and shows the home wordmarks", () => {
    render(court(1));
    expect(
      screen.getByRole("group", { name: "Court, Harbor Harriers home floor" }),
    ).toBeTruthy();
    const marks = screen
      .getAllByTestId("court-wordmark")
      .map((el) => el.textContent);
    expect(marks).toEqual(["Harriers", "Harriers", "Harbor"]);
  });

  it("shows the centre logo with branding and omits it without", () => {
    const { unmount } = render(court(1));
    expect(screen.getByTestId("court-centre-logo")).toBeTruthy();
    unmount();
    const bare: WatchTeam = { ...COURT_HOME, hasBranding: false };
    render(court(1, { home: bare }));
    expect(screen.queryByTestId("court-centre-logo")).toBeNull();
  });

  it("animates the ball once per play change, but not under reduced motion", () => {
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    Element.prototype.animate = animate as never;
    const { rerender } = render(court(1));
    expect(animate).not.toHaveBeenCalled();
    rerender(court(2));
    expect(animate).toHaveBeenCalledTimes(1);
    rerender(court(2));
    expect(animate).toHaveBeenCalledTimes(1);
    rerender(court(3));
    expect(animate).toHaveBeenCalledTimes(2);

    cleanup();
    animate.mockClear();
    mockMatchMedia(true);
    const reduced = render(court(1));
    reduced.rerender(court(2));
    reduced.rerender(court(3));
    expect(animate).not.toHaveBeenCalled();
  });

  it("starts the ball at the transition and lengthens the flight", () => {
    const frame = buildFullCourtFrame(VIEW, 1);
    expect(frame.transition).not.toBeNull();
    const calls: { keyframes: Keyframe[]; duration: number }[] = [];
    Element.prototype.animate = function (
      this: Element,
      keyframes: Keyframe[],
      options: { duration: number },
    ) {
      if (this.getAttribute("data-testid") === "court-ball") {
        calls.push({ keyframes, duration: options.duration });
      }
      return { cancel: vi.fn() };
    } as never;
    const { rerender } = render(court(0));
    rerender(court(1));
    expect(calls).toHaveLength(1);
    const first = calls[0]!.keyframes[0]!;
    expect(first).toMatchObject({
      left: pct(frame.transition![0]!.x),
      top: pct(frame.transition![0]!.y),
    });
    expect(calls[0]!.duration).toBeGreaterThanOrEqual(TRANSITION_MS);
    const offsets = calls[0]!.keyframes.map((k) => k.offset!);
    expect(offsets[0]).toBe(0);
    expect(offsets.at(-1)).toBe(1);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });

  it("falls back to the plain play motion without a transition", () => {
    const frame = buildFullCourtFrame(VIEW, 3);
    expect(frame.transition).toBeNull();
    const motion = fullCourtBallMotion(frame.lastPlay!, null);
    expect(motion).not.toBeNull();
    expect(motion!.duration).toBeLessThan(TRANSITION_MS + 2000);
  });

  it("toggles shot chart markers matching the revealed shots", () => {
    const frame = buildFullCourtFrame(VIEW, 9);
    expect(frame.shots.length).toBeGreaterThan(0);
    render(court(9));
    expect(screen.queryAllByTestId("court-shot-marker")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Shot chart" }));
    expect(screen.getAllByTestId("court-shot-marker")).toHaveLength(
      frame.shots.length,
    );
  });

  it("adds a halo outline when a token cannot clear its lane with one ring", () => {
    const magenta: WatchTeam = {
      ...COURT_HOME,
      branding: { ...COURT_HOME.branding, primaryColor: "#FF00FF" },
    };
    const white: WatchTeam = {
      ...COURT_AWAY,
      branding: { ...COURT_AWAY.branding, primaryColor: "#FFFFFF" },
    };
    const palette = buildCourtPalette(magenta.branding);
    const outline = tokenOutline("#FFFFFF", palette);
    render(court(1, { home: magenta, away: white }));
    const shadows = screen
      .getAllByTestId("court-token")
      .map((el) => (el.firstElementChild as HTMLElement).style.boxShadow);
    expect(outline.halo).not.toBeNull();
    expect(shadows).toContain(`0 0 0 2px ${outline.halo}`);
  });

  it("shows a steal callout", () => {
    render(court(4));
    expect(screen.getByText("Steal · Reed")).toBeTruthy();
  });
});

describe("FullCourtLines", () => {
  it("draws two rims and a full-opacity stroke by default", () => {
    const { container } = render(
      <svg>
        <FullCourtLines />
      </svg>,
    );
    const rims = container.querySelectorAll('circle[r="0.75"]');
    expect(rims).toHaveLength(2);
    expect(container.querySelector("g")!.getAttribute("stroke-opacity")).toBe(
      "1",
    );
  });
});
