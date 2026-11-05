import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  COURT_AWAY,
  COURT_FIXTURE_VIEW,
  COURT_HOME,
} from "@/app/dev/broadcast-ui/court-fixture";
import { FullCourtView } from "@/components/game/watch/court/FullCourtView";
import { tiltTranslate } from "@/components/game/watch/court/court-tilt";
import { CourtFxLayer } from "@/components/game/watch/court/fx/CourtFxLayer";
import { CourtFxScene } from "@/components/game/watch/court/fx/fx-scene";
import { buildPlayChoreography } from "@/state/watch-court-choreo";
import { buildLiveBoxScore } from "@/state/watch-game-selectors";
import { buildFullCourtFrame } from "@/state/watch-full-court";

const scenes = vi.hoisted(() => ({
  created: [] as Array<{
    destroy: ReturnType<typeof vi.fn>;
    sync: ReturnType<typeof vi.fn>;
    setSize: ReturnType<typeof vi.fn>;
  }>,
  fail: false,
}));

// Pixi needs a GPU; the layer's contract with the scene is what is tested here.
vi.mock("@/components/game/watch/court/fx/fx-scene", () => ({
  CourtFxScene: {
    create: vi.fn(async () => {
      if (scenes.fail) {
        throw new Error("no WebGL");
      }
      const scene = {
        destroy: vi.fn(),
        sync: vi.fn(),
        setSize: vi.fn(),
      };
      scenes.created.push(scene);
      return scene;
    }),
  },
}));

const FRAME = buildFullCourtFrame(COURT_FIXTURE_VIEW, 1);

function mockMatchMedia(reduce: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduce,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

function setNavigator(name: string, value: unknown) {
  Object.defineProperty(window.navigator, name, {
    configurable: true,
    value,
  });
}

function layer(width = 800) {
  return (
    <CourtFxLayer
      width={width}
      height={425}
      getClock={() => null}
      frame={FRAME}
      choreography={null}
      cues={[]}
      motionMs={1500}
      speed={1}
      playing={false}
      run={null}
      dimmed={false}
      celebration={null}
      colors={["#0B1F3A", "#F2F0E6"]}
      seed={1}
    />
  );
}

/** Lets the layer's dynamic import and scene creation finish. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

beforeEach(() => {
  scenes.created.length = 0;
  scenes.fail = false;
  mockMatchMedia(false);
  setNavigator("webdriver", false);
  setNavigator("hardwareConcurrency", 8);
});

afterEach(() => {
  cleanup();
});

describe("CourtFxLayer", () => {
  it("is decorative and out of the way", () => {
    render(layer());
    const host = screen.getByTestId("court-fx");
    expect(host.getAttribute("aria-hidden")).toBe("true");
    expect(host.className).toContain("pointer-events-none");
  });

  it("starts a scene and hands it the court state", async () => {
    render(layer());
    await settle();
    expect(scenes.created).toHaveLength(1);
    const input = scenes.created[0]!.sync.mock.calls[0]![0];
    expect(input.frame).toBe(FRAME);
    expect(input).not.toHaveProperty("width");
  });

  it("gives each canvas its own host, the second above the tokens", async () => {
    render(layer());
    const over = screen.getByTestId("court-fx-over");
    expect(over.getAttribute("aria-hidden")).toBe("true");
    expect(over.className).toContain("pointer-events-none");
    expect(over.className).toContain("z-25");
  });

  it("destroys the scene on unmount", async () => {
    const { unmount } = render(layer());
    await settle();
    unmount();
    expect(scenes.created[0]!.destroy).toHaveBeenCalledTimes(1);
  });

  it("leaves one live scene under Strict Mode", async () => {
    render(<StrictMode>{layer()}</StrictMode>);
    await vi.waitFor(() => expect(scenes.created).toHaveLength(2));
    await settle();
    const live = scenes.created.filter(
      (scene) => scene.destroy.mock.calls.length === 0,
    );
    expect(live).toHaveLength(1);
  });

  it("forwards a resize", async () => {
    const { rerender } = render(layer(800));
    await settle();
    rerender(layer(1000));
    expect(scenes.created[0]!.setSize).toHaveBeenLastCalledWith(1000, 425);
  });

  it("survives a renderer that cannot start", async () => {
    scenes.fail = true;
    render(layer());
    await settle();
    expect(scenes.created).toHaveLength(0);
    expect(screen.getByTestId("court-fx")).toBeTruthy();
  });

  it.each([
    ["reduced motion", () => mockMatchMedia(true)],
    ["an automated browser", () => setNavigator("webdriver", true)],
    ["a low-power device", () => setNavigator("hardwareConcurrency", 2)],
  ])("starts nothing under %s", async (_label, arrange) => {
    arrange();
    render(layer());
    await settle();
    expect(scenes.created).toHaveLength(0);
  });

  it("starts nothing on a tiny court", async () => {
    render(layer(300));
    await settle();
    expect(scenes.created).toHaveLength(0);
  });

  it("does not start until the court is wide enough, then does", async () => {
    const { rerender } = render(layer(300));
    await settle();
    rerender(layer(800));
    await settle();
    expect(scenes.created).toHaveLength(1);
  });
});

describe("FullCourtView effects", () => {
  const court = (
    fx?: Parameters<typeof FullCourtView>[0]["fx"],
    tilt = false,
  ) => (
    <FullCourtView
      tilt={tilt}
      frame={FRAME}
      home={COURT_HOME}
      away={COURT_AWAY}
      live={buildLiveBoxScore(COURT_FIXTURE_VIEW, 1)}
      players={COURT_FIXTURE_VIEW.players}
      fx={fx}
    />
  );

  it("stays overhead unless asked to tilt", () => {
    render(court());
    expect(screen.getByTestId("court-floor").style.transform).toBe("");
    expect(screen.getByTestId("court-ball").style.transform).not.toContain(
      "scale",
    );
    expect(screen.queryByTestId("court-hoops-back")).toBeNull();
  });

  it("tilts the floor and places what stands on it to match", () => {
    render(
      <FullCourtView
        frame={FRAME}
        home={COURT_HOME}
        away={COURT_AWAY}
        live={buildLiveBoxScore(COURT_FIXTURE_VIEW, 1)}
        players={COURT_FIXTURE_VIEW.players}
        tilt
      />,
    );
    expect(screen.getByTestId("court-floor").style.transform).toContain(
      "rotateX",
    );
    expect(screen.getByTestId("court-ball").style.transform).toBe(
      tiltTranslate(FRAME.ball.at),
    );
    // Raised hoops replace the ones painted on the floor.
    expect(screen.getByTestId("court-hoops-back")).toBeTruthy();
    expect(screen.getByTestId("court-hoops-front")).toBeTruthy();
    // Tokens remain real, upright controls rather than part of the floor.
    expect(
      screen
        .getByTestId("court-floor")
        .querySelector("[data-testid=court-token]"),
    ).toBeNull();
    expect(screen.getAllByTestId("court-token").length).toBeGreaterThan(0);
  });

  it("has no effects layer unless asked for one", () => {
    render(court());
    expect(screen.queryByTestId("court-fx")).toBeNull();
  });

  const smith = () =>
    screen
      .getAllByTestId("court-token")
      .find((token) => token.getAttribute("data-player-id") === "h1")!;

  const FX = { cues: [], celebration: null, seed: 1 };
  const figureCount = () =>
    screen
      .getAllByTestId("court-token")
      .filter((token) => token.querySelector("[data-figure]")).length;

  it("stands every floor player up once a scene is drawing, tilted", async () => {
    render(court(FX, true));
    expect(figureCount()).toBe(0);
    await settle();
    expect(figureCount()).toBe(10);
    const input = scenes.created[0]!.sync.mock.lastCall![0];
    expect(input.athletes).toHaveLength(10);
    // Still a real control, still named.
    expect(smith().getAttribute("aria-label")).toContain("Jalen Smith");
    expect(smith().querySelector("[data-figure]")).not.toBeNull();
  });

  it("keeps discs overhead, even with the effects running", async () => {
    render(court(FX));
    await settle();
    expect(figureCount()).toBe(0);
    expect(scenes.created[0]!.sync.mock.lastCall![0].athletes).toEqual([]);
  });

  it("only tells a play the time while the court is running that play", async () => {
    // The layer hears of a new play after the court starts it. In that gap the
    // old play must not read the new play's clock, or its burst is dropped.
    const original = Element.prototype.animate;
    Element.prototype.animate = function () {
      return {
        currentTime: 250,
        playState: "running",
        effect: {
          target: this,
          getComputedTiming: () => ({ endTime: 1000 }),
        },
        cancel: () => undefined,
        pause: () => undefined,
        play: () => undefined,
        updatePlaybackRate: () => undefined,
      } as unknown as Animation;
    };
    try {
      const fx = { cues: [], celebration: null, seed: 1 };
      const first = buildPlayChoreography(COURT_FIXTURE_VIEW, 0)!;
      const second = buildPlayChoreography(COURT_FIXTURE_VIEW, 1)!;
      const playing = (choreography: typeof first, revealed: number) => (
        <FullCourtView
          frame={buildFullCourtFrame(COURT_FIXTURE_VIEW, revealed)}
          home={COURT_HOME}
          away={COURT_AWAY}
          live={buildLiveBoxScore(COURT_FIXTURE_VIEW, revealed)}
          players={COURT_FIXTURE_VIEW.players}
          fx={fx}
          choreography={choreography}
          motionMs={1000}
        />
      );
      const { rerender } = render(playing(first, 1));
      await settle();
      const create = vi.mocked(CourtFxScene.create);
      const clock = create.mock.lastCall![2];
      expect(clock(first)).toBe(0.25);
      expect(clock(second)).toBeNull();

      rerender(playing(second, 2));
      expect(clock(first)).toBeNull();
      expect(clock(second)).toBe(0.25);
    } finally {
      Element.prototype.animate = original;
    }
  });

  it("keeps a play's moment when the camera changes mid-play", () => {
    const started: { keyframes: Keyframe[]; currentTime: number }[] = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function (
      this: Element,
      keyframes: Keyframe[],
    ) {
      const animation = {
        keyframes,
        currentTime: 0,
        playState: "running",
        effect: { target: this },
        cancel: () => undefined,
        pause: () => undefined,
        play: () => undefined,
        updatePlaybackRate: () => undefined,
      };
      started.push(animation);
      return animation as unknown as Animation;
    } as typeof Element.prototype.animate;
    try {
      const choreography = buildPlayChoreography(COURT_FIXTURE_VIEW, 0)!;
      const playing = (tilt: boolean) => (
        <FullCourtView
          frame={buildFullCourtFrame(COURT_FIXTURE_VIEW, 1)}
          home={COURT_HOME}
          away={COURT_AWAY}
          live={buildLiveBoxScore(COURT_FIXTURE_VIEW, 1)}
          players={COURT_FIXTURE_VIEW.players}
          choreography={choreography}
          motionMs={1000}
          tilt={tilt}
        />
      );
      const { rerender } = render(playing(true));
      const firstRun = started.length;
      expect(firstRun).toBeGreaterThan(0);
      expect(String(started[0]!.keyframes[0]!.transform)).toContain("scale");
      started[0]!.currentTime = 400;

      rerender(playing(false));
      expect(started.length).toBe(firstRun * 2);
      const again = started[firstRun]!;
      expect(again.currentTime).toBe(400);
      expect(String(again.keyframes[0]!.transform)).not.toContain("scale");
    } finally {
      Element.prototype.animate = original;
    }
  });

  it("keeps the discs when the renderer cannot start", async () => {
    scenes.fail = true;
    render(court(FX, true));
    await settle();
    expect(figureCount()).toBe(0);
  });

  it("keeps the discs under reduced motion", async () => {
    mockMatchMedia(true);
    render(court(FX, true));
    await settle();
    expect(figureCount()).toBe(0);
  });

  it("mounts the layer inside the floor, before the tokens", () => {
    render(court({ cues: [], celebration: null, seed: 1 }));
    const fx = screen.getByTestId("court-fx");
    const ball = screen.getByTestId("court-ball");
    expect(fx.parentElement).toBe(ball.parentElement);
    expect(
      fx.compareDocumentPosition(ball) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
