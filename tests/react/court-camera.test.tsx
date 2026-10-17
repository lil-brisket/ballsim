import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FullCourtView } from "@/components/game/watch/court/FullCourtView";
import {
  BROADCAST_TILT_DEG,
  FOLLOW_FEET,
  courtCamera,
} from "@/components/game/watch/court/court-camera";
import {
  COURT_AWAY,
  COURT_FIXTURE_VIEW,
  COURT_HOME,
} from "@/app/dev/broadcast-ui/court-fixture";
import { buildLiveBoxScore } from "@/state/watch-game-selectors";
import { FULL_COURT_FEET, buildFullCourtFrame } from "@/state/watch-full-court";

const VIEW = COURT_FIXTURE_VIEW;
const STORAGE_KEY = "ballsim:courtView";

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

const camera = () => screen.getByTestId("court-camera");
const stage = () => screen.getByTestId("court-camera-stage");
const viewButton = (name: string) => screen.getByRole("button", { name });
const tokenNames = () =>
  screen
    .getAllByTestId("court-token")
    .map((token) => token.getAttribute("aria-label"));

const originalMatchMedia = window.matchMedia;

beforeEach(() => {
  mockMatchMedia(false);
  // The view preference is module state too; start every test on Broadcast.
  window.localStorage.setItem(STORAGE_KEY, "broadcast");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.removeItem(STORAGE_KEY);
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: originalMatchMedia,
  });
});

describe("courtCamera", () => {
  const stageScale = FULL_COURT_FEET.length / FOLLOW_FEET;

  it("follows the attacking half in Broadcast", () => {
    const left = courtCamera("broadcast", "left");
    const right = courtCamera("broadcast", "right");
    expect(left.framing).toBe("follow");
    expect(left.aspect).toBe(`${FOLLOW_FEET} / ${FULL_COURT_FEET.width}`);
    expect(left.stageWidth).toBe(
      `${Math.round(stageScale * 1000000) / 10000}%`,
    );
    expect(left.transform).toBe("translate(0%, 0%) scale(1)");
    // The right end: pan so the right baseline sits on the viewport edge.
    const offset =
      (FULL_COURT_FEET.length - FOLLOW_FEET) / FULL_COURT_FEET.length;
    expect(right.transform).toBe(
      `translate(${-Math.round(offset * 1000000) / 10000}%, 0%) scale(1)`,
    );
    // Each follow framing shows the attacking half plus some backcourt.
    expect(FOLLOW_FEET).toBeGreaterThan(FULL_COURT_FEET.length / 2);
    // The perspective centres on the visible floor at each end.
    expect(left.perspectiveOrigin).toBe("31.9149% 50%");
    expect(right.perspectiveOrigin).toBe("68.0851% 50%");
    expect(left.tilt).toBe(BROADCAST_TILT_DEG);
    expect(right.tilt).toBe(BROADCAST_TILT_DEG);
  });

  it("follows tighter on phones", () => {
    const compact = courtCamera("broadcast", "right", false, true);
    expect(compact.aspect).toBe(`50 / ${FULL_COURT_FEET.width}`);
    expect(compact.transform).toBe("translate(-46.8085%, 0%) scale(1)");
    // Phones keep following for breaks and the final (tokens stay clickable).
    expect(courtCamera("broadcast", "right", true, true)).toEqual(compact);
    expect(courtCamera("top-down", "right", false, true)).toEqual(
      courtCamera("top-down", "right"),
    );
  });

  it("frames the whole floor for wide shots, in the same viewport", () => {
    const wide = courtCamera("broadcast", "right", true);
    expect(wide.framing).toBe("wide");
    expect(wide.aspect).toBe(courtCamera("broadcast", "left").aspect);
    expect(wide.transform).toMatch(
      /^translate\(0%, [\d.]+%\) scale\(0\.6383\)$/,
    );
    expect(courtCamera("broadcast", "left", true)).toEqual(wide);
    // Tokens undo the zoom so they keep their size and 44px hit area.
    expect(wide.tokenScale).toBeCloseTo(
      FULL_COURT_FEET.length / FOLLOW_FEET,
      3,
    );
    expect(courtCamera("broadcast", "left").tokenScale).toBe(1);
  });

  it("is flat and whole-floor in Top-down, whatever the end", () => {
    for (const end of ["left", "right"] as const) {
      for (const wide of [false, true]) {
        expect(courtCamera("top-down", end, wide)).toEqual({
          framing: "wide",
          aspect: `${FULL_COURT_FEET.length} / ${FULL_COURT_FEET.width}`,
          stageWidth: "100%",
          transform: "translate(0%, 0%) scale(1)",
          tilt: 0,
          tokenScale: 1,
          perspectiveOrigin: "50% 50%",
        });
      }
    }
  });
});

describe("FullCourtView camera", () => {
  const leftIndex = [...Array(VIEW.plays.length + 1).keys()].find(
    (n) => n > 0 && buildFullCourtFrame(VIEW, n).attackingEnd === "left",
  )!;
  const rightIndex = [...Array(VIEW.plays.length + 1).keys()].find(
    (n) => buildFullCourtFrame(VIEW, n).attackingEnd === "right",
  )!;

  it("defaults to the tilted Broadcast camera following the play", () => {
    window.localStorage.removeItem(STORAGE_KEY);
    render(court(leftIndex));
    expect(camera().getAttribute("data-camera-view")).toBe("broadcast");
    expect(camera().getAttribute("data-camera-framing")).toBe("follow");
    expect(viewButton("Broadcast").getAttribute("aria-pressed")).toBe("true");
    expect(stage().style.transform).toBe("translate(0%, 0%) scale(1)");
    expect(document.querySelector(".court-tilted")).not.toBeNull();
  });

  it("pans to the other end when the attacking end changes", () => {
    const { rerender } = render(court(leftIndex));
    const leftTransform = stage().style.transform;
    rerender(court(rightIndex));
    expect(stage().style.transform).not.toBe(leftTransform);
    expect(stage().style.transform).toBe(
      courtCamera("broadcast", "right").transform,
    );
  });

  it("goes wide on request", () => {
    render(court(rightIndex, { wide: true }));
    expect(camera().getAttribute("data-camera-framing")).toBe("wide");
    expect(camera().className).toContain("court-camera-wide");
  });

  it("switches to Top-down, remembers it, and leaves the play untouched", () => {
    const onSelectPlayer = vi.fn();
    render(court(rightIndex, { onSelectPlayer }));
    const before = tokenNames();
    fireEvent.click(viewButton("Top-down"));
    expect(camera().getAttribute("data-camera-view")).toBe("top-down");
    expect(camera().getAttribute("data-camera-framing")).toBe("wide");
    expect(viewButton("Top-down").getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector(".court-tilted")).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("top-down");
    expect(tokenNames()).toEqual(before);
    expect(onSelectPlayer).not.toHaveBeenCalled();

    cleanup();
    render(court(rightIndex));
    expect(camera().getAttribute("data-camera-view")).toBe("top-down");
  });

  it("still toggles when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    render(court(rightIndex));
    fireEvent.click(viewButton("Top-down"));
    expect(camera().getAttribute("data-camera-view")).toBe("top-down");
    fireEvent.click(viewButton("Broadcast"));
    expect(camera().getAttribute("data-camera-view")).toBe("broadcast");
  });

  it("cuts instead of panning under reduced motion", () => {
    mockMatchMedia(true);
    render(court(leftIndex));
    expect(camera().className).toContain("court-camera-static");
  });
});
