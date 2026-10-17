import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CourtView } from "@/components/game/watch/court/CourtView";
import {
  COURT_AWAY,
  COURT_FIXTURE_VIEW,
  COURT_HOME,
} from "@/app/dev/broadcast-ui/court-fixture";
import { asPlayerId } from "@/domain/ids";
import { buildCourtFrame } from "@/state/watch-court-frame";
import { buildLiveBoxScore } from "@/state/watch-game-selectors";

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
  extra: Partial<Parameters<typeof CourtView>[0]> = {},
) {
  return (
    <CourtView
      frame={buildCourtFrame(VIEW, revealed)}
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

describe("CourtView", () => {
  it("renders ten tokens named with live points", () => {
    render(court(1));
    expect(screen.getAllByTestId("court-token")).toHaveLength(10);
    expect(
      screen.getByRole("button", {
        name: /^Kai Lee, Harbor Harriers, 0 pts$/,
      }),
    ).toBeTruthy();
    // Smith's three at play 0 and the assist-less handler label.
    expect(
      screen.getByRole("button", { name: /^Jalen Smith, .*, 3 pts/ }),
    ).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: /^Kai Lee/ }));
    expect(onSelectPlayer).toHaveBeenCalledWith(asPlayerId("h2"));
    expect(
      screen
        .getByRole("button", { name: /^Kai Lee/ })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    rerender(court(1, { onSelectPlayer, selectedPlayerId: asPlayerId("h2") }));
    expect(
      screen
        .getByRole("button", { name: /^Kai Lee/ })
        .getAttribute("aria-pressed"),
    ).toBe("true");
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

  it("curls the shooter's token through the cut on a catch-and-shoot", () => {
    const index = VIEW.plays.findIndex(
      (p) => p.points > 1 && p.player2Id !== null,
    );
    const frame = buildCourtFrame(VIEW, index + 1);
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
      left: `${Math.round(frame.lastPlay!.cut!.x * 10000) / 100}%`,
      top: `${Math.round(frame.lastPlay!.cut!.y * 10000) / 100}%`,
    });
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

  it("toggles shot chart markers matching the revealed shots", () => {
    const frame = buildCourtFrame(VIEW, 9);
    expect(frame.shots.length).toBeGreaterThan(0);
    render(court(9));
    expect(screen.queryAllByTestId("court-shot-marker")).toHaveLength(0);
    const toggle = screen.getByRole("button", { name: "Shot chart" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByTestId("court-shot-marker")).toHaveLength(
      frame.shots.length,
    );
  });

  it("reports shot chart changes to a controlling parent", () => {
    const onShowShotChartChange = vi.fn();
    render(court(3, { showShotChart: false, onShowShotChartChange }));
    fireEvent.click(screen.getByRole("button", { name: "Shot chart" }));
    expect(onShowShotChartChange).toHaveBeenCalledWith(true);
  });

  it("shows who has the ball, and hides it at the final frame", () => {
    const { rerender } = render(court(1));
    const frame = buildCourtFrame(VIEW, 1);
    const abbreviation = frame.ballSide === 0 ? "HAR" : "SUM";
    expect(screen.getByText(`${abbreviation} ball`)).toBeTruthy();
    expect(screen.getByTestId("court-possession").textContent).toContain(
      "Possession:",
    );
    rerender(court(VIEW.plays.length));
    expect(screen.queryByTestId("court-possession")).toBeNull();
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
    Element.prototype.animate = ((
      _k: Keyframe[],
      options: { duration: number },
    ) => {
      durations.push(options.duration);
      return { cancel: vi.fn() };
    }) as never;
    const slow = render(court(1, { speed: 1 }));
    slow.rerender(court(2, { speed: 1 }));
    slow.unmount();
    const fast = render(court(1, { speed: 4 }));
    fast.rerender(court(2, { speed: 4 }));
    expect(durations).toHaveLength(2);
    expect(durations[1]).toBe(durations[0]! / 4);
  });
});
