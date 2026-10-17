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
import { asPlayerId } from "@/domain/ids";
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

  it("marks the ball handler in the accessible name", () => {
    // After the steal (play 3) Reed holds the ball.
    render(court(4));
    const handlers = screen
      .getAllByTestId("court-token")
      .filter((el) => /has the ball$/.test(el.getAttribute("aria-label")!));
    expect(handlers).toHaveLength(1);
    expect(handlers[0]!.getAttribute("aria-label")).toBe(
      "Tyrese Reed, Summit Glaciers, 0 pts, has the ball",
    );
  });

  it("calls onSelectPlayer and reflects the selected token", () => {
    const onSelectPlayer = vi.fn();
    const { rerender } = render(court(1, { onSelectPlayer }));
    const token = () => screen.getByRole("button", { name: /^Kai Lee/ });
    fireEvent.click(token());
    expect(onSelectPlayer).toHaveBeenCalledWith(asPlayerId("h2"));
    expect(token().getAttribute("aria-pressed")).toBe("false");
    rerender(court(1, { onSelectPlayer, selectedPlayerId: asPlayerId("h2") }));
    expect(token().getAttribute("aria-pressed")).toBe("true");
  });

  it("reports shot chart changes to a controlling parent", () => {
    const onShowShotChartChange = vi.fn();
    render(court(3, { showShotChart: false, onShowShotChartChange }));
    fireEvent.click(screen.getByRole("button", { name: "Shot chart" }));
    expect(onShowShotChartChange).toHaveBeenCalledWith(true);
  });

  it("shows a steal callout", () => {
    render(court(4));
    expect(screen.getByText("Steal · Reed")).toBeTruthy();
  });

  it("shows block and foul callouts", () => {
    const { unmount } = render(court(2));
    expect(screen.getByText("Block · Ortiz")).toBeTruthy();
    unmount();
    render(court(6));
    expect(screen.getByText("Foul · Ortiz")).toBeTruthy();
  });

  it("curls the shooter's token through the cut on a catch-and-shoot", () => {
    const index = VIEW.plays.findIndex(
      (p) => p.points > 1 && p.player2Id !== null,
    );
    const frame = buildFullCourtFrame(VIEW, index + 1);
    expect(frame.lastPlay!.cut).not.toBeNull();
    const targets: Element[] = [];
    const animate = vi.fn(function (this: Element) {
      targets.push(this);
      return { cancel: vi.fn() };
    });
    Element.prototype.animate = animate as never;
    const { rerender } = render(court(index));
    rerender(court(index + 1));
    expect(animate).toHaveBeenCalledTimes(2);
    expect(targets[1]!.getAttribute("data-player-id")).toBe(
      frame.lastPlay!.playerId,
    );
    const keyframes = (animate.mock.calls[1] as unknown[])[0] as Keyframe[];
    expect(keyframes).toHaveLength(3);
    expect(keyframes[1]).toMatchObject({
      left: pct(frame.lastPlay!.cut!.x),
      top: pct(frame.lastPlay!.cut!.y),
    });
  });

  it("marks a substitution with an In chip, a named token and a fading ghost", () => {
    const revealed = VIEW.plays.findIndex((p) => p.kind === "substitution") + 1;
    render(court(revealed));
    expect(screen.getByText("In")).toBeTruthy();
    expect(screen.getByText("Out")).toBeTruthy();
    const names = screen
      .getAllByTestId("court-token")
      .map((el) => el.getAttribute("aria-label")!);
    expect(names.filter((n) => n.endsWith(", just checked in"))).toHaveLength(
      1,
    );
    expect(
      screen.getByRole("button", { name: /^Sam Park, .*, just checked in$/ }),
    ).toBeTruthy();
    expect(screen.getAllByTestId("court-sub-ghost")).toHaveLength(1);
  });

  it("shows no substitution ghost under reduced motion", () => {
    mockMatchMedia(true);
    const revealed = VIEW.plays.findIndex((p) => p.kind === "substitution") + 1;
    render(court(revealed));
    expect(screen.queryByTestId("court-sub-ghost")).toBeNull();
    expect(screen.getByText("In")).toBeTruthy();
  });

  it("renders the period break card text", () => {
    const { rerender } = render(court(3));
    expect(screen.queryByTestId("court-period-card")).toBeNull();
    rerender(court(3, { periodBreak: "End of Q1 · SUM 5 – HAR 6" }));
    expect(screen.getByTestId("court-period-card").textContent).toBe(
      "End of Q1 · SUM 5 – HAR 6",
    );
  });

  it("divides the ball animation duration by the playback speed", () => {
    const durations: number[] = [];
    Element.prototype.animate = function (
      this: Element,
      _k: Keyframe[],
      options: { duration: number },
    ) {
      if (this.getAttribute("data-testid") === "court-ball") {
        durations.push(options.duration);
      }
      return { cancel: vi.fn() };
    } as never;
    const slow = render(court(1, { speed: 1 }));
    slow.rerender(court(2, { speed: 1 }));
    slow.unmount();
    const fast = render(court(1, { speed: 4 }));
    fast.rerender(court(2, { speed: 4 }));
    expect(durations).toHaveLength(2);
    expect(durations[1]).toBe(durations[0]! / 4);
  });

  it("shows a possession arrow toward the attacked end, hidden at the final frame", () => {
    const { rerender } = render(court(1));
    const frame = buildFullCourtFrame(VIEW, 1);
    expect(frame.ballEnd).not.toBeNull();
    const arrow = screen.getByTestId("court-possession");
    expect(arrow.getAttribute("data-end")).toBe(frame.ballEnd);
    expect(arrow.textContent).toContain("Possession:");
    rerender(court(VIEW.plays.length));
    expect(screen.queryByTestId("court-possession")).toBeNull();
  });

  it("brightens the centre logo for the final", () => {
    const { rerender } = render(court(1));
    const logo = () => screen.getByTestId("court-centre-logo");
    expect(logo().getAttribute("data-final")).toBeNull();
    rerender(court(1, { final: true }));
    expect(logo().getAttribute("data-final")).toBe("true");
    expect(logo().style.opacity).toBe("0.7");
  });

  it("marks both lanes", () => {
    render(court(1));
    expect(screen.getAllByTestId("court-lane")).toHaveLength(2);
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
