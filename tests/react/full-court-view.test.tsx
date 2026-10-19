import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FullCourtLines } from "@/components/game/court/FullCourtLines";
import { FullCourtView } from "@/components/game/watch/court/FullCourtView";
import {
  courtTranslate,
  smoothTrack,
} from "@/components/game/watch/court/court-motion";
import {
  COURT_AWAY,
  COURT_FIXTURE_VIEW,
  COURT_HOME,
} from "@/app/dev/broadcast-ui/court-fixture";
import { asPlayerId } from "@/domain/ids";
import { buildCourtPalette, tokenOutline } from "@/state/court-palette";
import { buildPlayChoreography } from "@/state/watch-court-choreo";
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

type MockAnimation = {
  target: Element;
  keyframes: Keyframe[];
  duration: number;
  playState: AnimationPlayState;
  cancel: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  updatePlaybackRate: ReturnType<typeof vi.fn>;
  effect: { target: Element };
};

/** Records every Element.animate call with a controllable animation. */
function mockAnimate(): MockAnimation[] {
  const started: MockAnimation[] = [];
  Element.prototype.animate = function (
    this: Element,
    keyframes: Keyframe[],
    options: { duration: number },
  ) {
    const animation: MockAnimation = {
      target: this,
      keyframes,
      duration: options.duration,
      playState: "running",
      cancel: vi.fn(() => {
        animation.playState = "idle";
      }),
      pause: vi.fn(() => {
        animation.playState = "paused";
      }),
      play: vi.fn(() => {
        animation.playState = "running";
      }),
      updatePlaybackRate: vi.fn(),
      effect: { target: this },
    };
    started.push(animation);
    return animation;
  } as never;
  return started;
}

/** The choreography of play `index`, with the props that run it. */
function motion(index: number, extra: { playing?: boolean } = {}) {
  const choreography = buildPlayChoreography(VIEW, index)!;
  return { choreography, motionMs: 1400, playing: true, ...extra };
}

const moverOf = (started: MockAnimation[], key: string) =>
  started.find((a) => a.target.getAttribute("data-mover") === key)!;

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

  /** Renders with the floor measured at `width` px (a stub ResizeObserver). */
  function withCourtWidth(width: number, run: () => void) {
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() {
        this.callback(
          [
            {
              contentRect: { width, height: (width * 50) / 94 },
            } as ResizeObserverEntry,
          ],
          this as unknown as ResizeObserver,
        );
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    try {
      run();
    } finally {
      globalThis.ResizeObserver = original;
    }
  }

  const labelState = () =>
    new Map(
      screen
        .getAllByTestId("court-token")
        .map((el) => [
          el.getAttribute("data-player-id")!,
          el.querySelector(".court-token-label")!.getAttribute("data-label"),
        ]),
    );

  it("shows only the handler, shooter and selected names on a narrow floor", () => {
    const frame = buildFullCourtFrame(VIEW, 4);
    const selected = frame.players.find((p) => p.role === "off-ball")!;
    withCourtWidth(343, () => {
      render(court(4, { selectedPlayerId: selected.playerId }));
    });
    const expected = frame.players
      .filter((p) => p.role !== "off-ball" || p.playerId === selected.playerId)
      .map((p) => p.playerId as string);
    for (const [id, state] of labelState()) {
      expect(state).toBe(expected.includes(id) ? "shown" : "hover");
    }
  });

  it("shows everyone's name that fits on a wide floor, the budget always", () => {
    const frame = buildFullCourtFrame(VIEW, 4);
    const selected = frame.players.find((p) => p.role === "off-ball")!;
    withCourtWidth(1150, () => {
      render(court(4, { selectedPlayerId: selected.playerId }));
    });
    const states = labelState();
    for (const p of frame.players) {
      if (p.role !== "off-ball" || p.playerId === selected.playerId) {
        expect(states.get(p.playerId)).toBe("shown");
      }
    }
    const shownCount = [...states.values()].filter((v) => v === "shown").length;
    expect(shownCount).toBeGreaterThan(3);
  });

  it("shows jersey numbers and double rings for the away team", () => {
    render(court(1));
    const discs = screen
      .getAllByTestId("court-token")
      .map((el) => el.firstElementChild as HTMLElement);
    const byId = new Map(VIEW.players.map((p) => [p.playerId as string, p]));
    for (const disc of discs) {
      const id = disc.closest("[data-mover]")!.getAttribute("data-mover")!;
      expect(disc.textContent).toBe(String(byId.get(id)!.jerseyNumber));
    }
    const jalen = screen.getByRole("button", { name: /^Jalen Smith,/ });
    expect(jalen.firstElementChild!.textContent).toBe("3");
    const rings = (side: string) =>
      discs
        .filter((d) => d.getAttribute("data-ring") === side)
        .map((d) => d.closest("[data-mover]")!.getAttribute("data-mover"));
    expect(rings("solid")).toHaveLength(5);
    expect(rings("double")).toHaveLength(5);
    expect(jalen.firstElementChild!.getAttribute("data-ring")).toBe("solid");
    expect(
      screen
        .getByRole("button", { name: /^Tyrese Reed,/ })
        .firstElementChild!.getAttribute("data-ring"),
    ).toBe("double");
  });

  it("falls back to monograms for a team whose numbers clash or are missing", () => {
    const players = VIEW.players.map((p) =>
      p.playerId === "h2" ? { ...p, jerseyNumber: 3 } : p,
    );
    render(court(1, { players }));
    const text = (name: RegExp) =>
      screen.getByRole("button", { name }).firstElementChild!.textContent;
    // Home (Smith 3 and Lee 3) shows monograms; away keeps its numbers.
    expect(text(/^Jalen Smith,/)).toBe("JS");
    expect(text(/^Kai Lee,/)).toMatch(/^[A-Z]{2}$/);
    expect(text(/^Tyrese Reed,/)).toBe("14");
    cleanup();
    const missing = VIEW.players.map((p) =>
      p.side === 1 && p.playerId === "a1" ? { ...p, jerseyNumber: null } : p,
    );
    render(court(1, { players: missing }));
    expect(text(/^Tyrese Reed,/)).toMatch(/^[A-Z]{2}$/);
    expect(text(/^Jalen Smith,/)).toBe("3");
  });

  it("labels the group with the home floor and shows the home wordmarks", () => {
    render(court(1));
    expect(
      screen.getByRole("group", { name: "Court, Harbor Harriers home floor" }),
    ).toBeTruthy();
    const marks = screen
      .getAllByTestId("court-wordmark")
      .map((el) => el.textContent);
    expect(marks).toEqual(["Harriers", "Harriers"]);
  });

  it("shows the ribbon only for a run in progress", () => {
    const { rerender } = render(court(1));
    expect(screen.queryByTestId("court-ribbon")).toBeNull();
    rerender(court(1, { run: { side: 1, points: 8 } }));
    expect(screen.getByTestId("court-ribbon").textContent).toBe(
      `${COURT_AWAY.abbreviation} 8–0 run`,
    );
  });

  it("shows the centre logo with branding and omits it without", () => {
    const { unmount } = render(court(1));
    expect(screen.getByTestId("court-centre-logo")).toBeTruthy();
    unmount();
    const bare: WatchTeam = { ...COURT_HOME, hasBranding: false };
    render(court(1, { home: bare }));
    expect(screen.queryByTestId("court-centre-logo")).toBeNull();
  });

  it("places tokens and the ball with transforms, never left/top", () => {
    const frame = buildFullCourtFrame(VIEW, 3);
    const { container } = render(court(3));
    for (const token of screen.getAllByTestId("court-token")) {
      expect(token.style.left).toBe("");
      expect(token.style.top).toBe("");
    }
    for (const player of frame.players) {
      const mover = container.querySelector<HTMLElement>(
        `[data-mover="${player.playerId}"]`,
      )!;
      expect(mover.style.transform).toBe(courtTranslate(player.spot));
    }
    const ball = screen.getByTestId("court-ball");
    expect(ball.style.left).toBe("");
    expect(ball.style.transform).toBe(courtTranslate(frame.ball.at));
  });

  it("runs a play's choreography on every token and the ball, once", () => {
    const started = mockAnimate();
    const play = motion(2);
    const { rerender } = render(court(2));
    expect(started).toHaveLength(0);
    rerender(court(3, play));
    // One per token, the ball over the floor and the ball's lift.
    expect(started).toHaveLength(play.choreography.tracks.length + 2);
    rerender(court(3, play));
    expect(started).toHaveLength(play.choreography.tracks.length + 2);
    for (const track of play.choreography.tracks) {
      const keyframes = moverOf(started, track.playerId).keyframes;
      // Every beat is hit exactly; samples in between smooth the run.
      play.choreography.beats.forEach((beat, k) => {
        const frame = keyframes.find((f) => f.offset === beat);
        expect(frame?.transform).toBe(courtTranslate(track.points[k]!));
      });
      const offsets = keyframes.map((f) => f.offset!);
      expect(offsets[0]).toBe(0);
      expect(offsets.at(-1)).toBe(1);
      expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
    }
  });

  it("starts no animation under reduced motion", () => {
    const started = mockAnimate();
    mockMatchMedia(true);
    const { rerender } = render(court(2));
    rerender(court(3, motion(2)));
    expect(started).toHaveLength(0);
  });

  it("brings the ball up the floor from where the last play left it", () => {
    const started = mockAnimate();
    const from = buildFullCourtFrame(VIEW, 0);
    const to = buildFullCourtFrame(VIEW, 1);
    expect(to.transition).not.toBeNull();
    const { rerender } = render(court(0));
    rerender(court(1, motion(0)));
    const ball = moverOf(started, "ball");
    const path = ball.keyframes.map((k) => k.transform);
    expect(path[0]).toBe(courtTranslate(from.ball.at));
    expect(path.at(-1)).toBe(courtTranslate(to.ball.at));
    for (const point of to.transition!.slice(1)) {
      expect(path).toContain(courtTranslate(point));
    }
    const offsets = ball.keyframes.map((k) => k.offset!);
    expect(offsets[0]).toBe(0);
    expect(offsets.at(-1)).toBe(1);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });

  it("pauses a running play rather than cancelling it, and resumes it", () => {
    const started = mockAnimate();
    const play = motion(2);
    const { rerender } = render(court(2));
    rerender(court(3, play));
    rerender(court(3, { ...play, playing: false }));
    for (const animation of started) {
      expect(animation.pause).toHaveBeenCalledTimes(1);
      expect(animation.cancel).not.toHaveBeenCalled();
    }
    rerender(court(3, play));
    for (const animation of started) {
      expect(animation.play).toHaveBeenCalledTimes(1);
    }
  });

  it("starts a play paused when it is revealed while paused", () => {
    const started = mockAnimate();
    const { rerender } = render(court(2));
    rerender(court(3, motion(2, { playing: false })));
    expect(started.length).toBeGreaterThan(0);
    for (const animation of started) {
      expect(animation.playState).toBe("paused");
    }
  });

  it("cancels the running play and snaps to the frame on a jump", () => {
    const started = mockAnimate();
    const { rerender } = render(court(2));
    rerender(court(3, motion(2)));
    rerender(court(8));
    for (const animation of started) {
      expect(animation.cancel).toHaveBeenCalledTimes(1);
    }
    const frame = buildFullCourtFrame(VIEW, 8);
    expect(screen.getByTestId("court-ball").style.transform).toBe(
      courtTranslate(frame.ball.at),
    );
  });

  it("retimes a running play on a speed change instead of restarting it", () => {
    const started = mockAnimate();
    const play = motion(2);
    const { rerender } = render(court(2));
    rerender(court(3, play));
    const count = started.length;
    rerender(court(3, { ...play, speed: 4 }));
    expect(started).toHaveLength(count);
    for (const animation of started) {
      expect(animation.updatePlaybackRate).toHaveBeenCalledWith(4);
    }
  });

  it("draws shot chart markers matching the revealed shots only when shown", () => {
    const frame = buildFullCourtFrame(VIEW, 9);
    expect(frame.shots.length).toBeGreaterThan(0);
    const { rerender } = render(court(9, { showShotChart: false }));
    expect(screen.queryAllByTestId("court-shot-marker")).toHaveLength(0);
    rerender(court(9, { showShotChart: true }));
    expect(screen.getAllByTestId("court-shot-marker")).toHaveLength(
      frame.shots.length,
    );
  });

  it("adds a halo outline when a token cannot clear the floor and lane with one ring", () => {
    const magenta: WatchTeam = {
      ...COURT_HOME,
      branding: { ...COURT_HOME.branding, primaryColor: "#FF00FF" },
    };
    const dark: WatchTeam = {
      ...COURT_AWAY,
      branding: { ...COURT_AWAY.branding, primaryColor: "#0A0A0A" },
    };
    const palette = buildCourtPalette(magenta.branding);
    const outline = tokenOutline("#0A0A0A", palette);
    render(court(1, { home: magenta, away: dark }));
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
    const started = mockAnimate();
    const { rerender } = render(court(index));
    rerender(court(index + 1, motion(index)));
    const shooter = moverOf(started, frame.lastPlay!.playerId);
    expect(shooter.keyframes.map((k) => k.transform)).toContain(
      courtTranslate(frame.lastPlay!.cut!),
    );
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

  it("divides the choreography duration by the playback speed", () => {
    const durations: number[] = [];
    for (const speed of [1, 4]) {
      const started = mockAnimate();
      const view = render(court(2, { speed }));
      view.rerender(court(3, { ...motion(2), speed }));
      durations.push(moverOf(started, "ball").duration);
      view.unmount();
    }
    expect(durations).toEqual([1400, 350]);
  });

  it("delays the rim flash until the ball reaches the rim", () => {
    mockAnimate();
    const index = VIEW.plays.findIndex((p) => p.points > 1);
    const play = motion(index);
    const { rerender } = render(court(index));
    rerender(court(index + 1, play));
    const flash = screen.getByTestId("court-rim-flash");
    const delay = Number.parseInt(flash.style.animationDelay, 10);
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThan(play.motionMs);
  });

  it("shows a possession arrow toward the attacked end, hidden at the final frame", () => {
    const { rerender } = render(court(1));
    const frame = buildFullCourtFrame(VIEW, 1);
    expect(frame.ballEnd).not.toBeNull();
    const arrow = screen.getByTestId("court-possession");
    expect(arrow.getAttribute("data-end")).toBe(frame.ballEnd);
    expect(arrow.textContent).toContain("Possession:");
    // It sits on the scorer's table, not over the floor.
    expect(arrow.closest(".court-viewport")).toBeNull();
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

  it("draws lines inside the lanes in the lane line colour", () => {
    const { container } = render(court(1));
    const palette = buildCourtPalette(COURT_HOME.branding);
    const clipped = container.querySelector<SVGGElement>("svg g[clip-path]");
    expect(clipped).not.toBeNull();
    const probe = document.createElement("span");
    probe.style.color = palette.laneLine;
    expect(clipped!.style.color).toBe(probe.style.color);
  });

  it("draws lines inside the lanes in the lane line colour", () => {
    const { container } = render(court(1));
    const palette = buildCourtPalette(COURT_HOME.branding);
    const clipped = container.querySelector<SVGGElement>("svg g[clip-path]");
    expect(clipped).not.toBeNull();
    const probe = document.createElement("span");
    probe.style.color = palette.laneLine;
    expect(clipped!.style.color).toBe(probe.style.color);
  });

  it("marks both lanes", () => {
    render(court(1));
    expect(screen.getAllByTestId("court-lane")).toHaveLength(2);
  });
});

describe("smoothTrack", () => {
  const beats = [0, 0.3, 0.6, 1];

  it("passes exactly through every beat", () => {
    const points = [
      { x: 0.1, y: 0.2 },
      { x: 0.4, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.9, y: 0.1 },
    ];
    const at = smoothTrack(beats, points);
    beats.forEach((t, k) => {
      expect(at(t).x).toBeCloseTo(points[k]!.x, 10);
      expect(at(t).y).toBeCloseTo(points[k]!.y, 10);
    });
  });

  it("never overshoots a beat and holds still where the player stops", () => {
    const points = [
      { x: 0.1, y: 0.5 },
      { x: 0.6, y: 0.5 },
      { x: 0.6, y: 0.5 },
      { x: 0.2, y: 0.5 },
    ];
    const at = smoothTrack(beats, points);
    for (let t = 0; t <= 1; t += 0.01) {
      expect(at(t).x).toBeGreaterThanOrEqual(0.1 - 1e-9);
      expect(at(t).x).toBeLessThanOrEqual(0.6 + 1e-9);
    }
    for (let t = 0.3; t <= 0.6; t += 0.05) {
      expect(at(t).x).toBeCloseTo(0.6, 10);
    }
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
