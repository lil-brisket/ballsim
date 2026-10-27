import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/roster",
  useRouter: () => ({ push }),
}));

import { OWNER_NAV_GROUPS } from "@/application/owner-nav-config";
import { ControlLegend } from "@/components/game/shell/ControlLegend";
import { GamepadBridge } from "@/components/game/shell/GamepadBridge";
import { OPEN_COMMAND_PALETTE } from "@/components/game/shell/hub-keys";
import { ShellKeys } from "@/components/game/shell/ShellKeys";
import { SimulationActivityProvider } from "@/components/game/simulation-activity";
import { FocusGrid } from "@/components/ui/focus/FocusGrid";
import { setInputMode } from "@/components/ui/focus/input-mode";

type Frame = (time: number) => void;
let queued: Map<number, Frame>;
let nextId: number;
let now: number;
let down: Set<number>;
let axes: number[];
let connected: boolean;
let mapping: string;
let rafSpy: ReturnType<typeof vi.fn>;

const onSim = vi.fn((e: React.MouseEvent) => e.preventDefault());
const onTile = vi.fn((e: React.MouseEvent) => e.preventDefault());

function fakePad(): Gamepad {
  return {
    index: 0,
    connected: true,
    mapping,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: down.has(i),
      touched: false,
      value: down.has(i) ? 1 : 0,
    })),
  } as unknown as Gamepad;
}

/** Run the queued animation frame(s), `ms` after the last. */
function pump(ms = 16) {
  now += ms;
  const frames = [...queued.values()];
  queued.clear();
  act(() => {
    for (const frame of frames) frame(now);
  });
}

/** Press then release buttons across two frames. */
function tap(...buttons: number[]) {
  buttons.forEach((b) => down.add(b));
  pump();
  buttons.forEach((b) => down.delete(b));
  pump();
}

function connect() {
  connected = true;
  act(() => {
    window.dispatchEvent(new Event("gamepadconnected"));
  });
  // First frame records the idle snapshot so later presses are edges.
  pump();
}

beforeEach(() => {
  push.mockReset();
  onSim.mockClear();
  onTile.mockClear();
  queued = new Map();
  nextId = 1;
  now = 0;
  down = new Set();
  axes = [0, 0, 0, 0];
  connected = false;
  mapping = "standard";
  rafSpy = vi.fn((cb: Frame) => {
    const id = nextId++;
    queued.set(id, cb);
    return id;
  });
  vi.stubGlobal("requestAnimationFrame", rafSpy);
  vi.stubGlobal("cancelAnimationFrame", (id: number) => queued.delete(id));
  Object.defineProperty(navigator, "getGamepads", {
    configurable: true,
    value: () => (connected ? [fakePad(), null] : [null]),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "getGamepads");
  delete document.documentElement.dataset.input;
  document.body.focus();
});

function placeTiles() {
  const positions: Record<string, [number, number]> = {
    A: [0, 0],
    B: [110, 0],
    C: [0, 110],
  };
  for (const [name, [left, top]] of Object.entries(positions)) {
    const link = screen.getByRole("link", { name });
    link.getBoundingClientRect = () =>
      ({
        left,
        top,
        right: left + 100,
        bottom: top + 100,
        width: 100,
        height: 100,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
    Object.defineProperty(link, "offsetParent", { value: document.body });
  }
}

function renderApp(options: { pending?: boolean } = {}) {
  const view = render(
    <SimulationActivityProvider initialPending={options.pending}>
      <GamepadBridge />
      <ShellKeys saveId="save_test" groups={OWNER_NAV_GROUPS} />
      <ControlLegend hubCount={8} />
      <header>
        <a href="/sim" aria-label="Sim to next game" onClick={onSim}>
          Sim
        </a>
      </header>
      <main>
        <FocusGrid aria-label="Tiles">
          <a href="/a" data-focus-item onClick={onTile}>
            A
          </a>
          <a href="/b" data-focus-item onClick={onTile}>
            B
          </a>
          <a href="/c" data-focus-item onClick={onTile}>
            C
          </a>
        </FocusGrid>
      </main>
    </SimulationActivityProvider>,
  );
  placeTiles();
  return view;
}

describe("GamepadBridge", () => {
  it("does not poll until a pad connects", () => {
    renderApp();
    expect(rafSpy).not.toHaveBeenCalled();
    connect();
    expect(rafSpy).toHaveBeenCalled();
  });

  it("d-pad focuses the first tile, then moves focus through the grid", () => {
    renderApp();
    connect();
    tap(13);
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "A" }),
    );
    tap(15);
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "B" }),
    );
    tap(14);
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "A" }),
    );
    tap(13);
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "C" }),
    );
  });

  it("the left stick moves focus too", () => {
    renderApp();
    connect();
    screen.getByRole("link", { name: "A" }).focus();
    axes = [0.9, 0, 0, 0];
    pump();
    axes = [0, 0, 0, 0];
    pump();
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "B" }),
    );
  });

  it("confirm clicks the focused tile", () => {
    renderApp();
    connect();
    screen.getByRole("link", { name: "B" }).focus();
    tap(0);
    expect(onTile).toHaveBeenCalledTimes(1);
  });

  it("shoulders step hubs through the shell keys", () => {
    renderApp();
    connect();
    tap(5);
    expect(push).toHaveBeenLastCalledWith("/dashboard/save_test/league", {
      transitionTypes: ["hub-forward"],
    });
    tap(4);
    expect(push).toHaveBeenLastCalledWith("/dashboard/save_test", {
      transitionTypes: ["hub-back"],
    });
  });

  it("back goes up a level, start clicks the Sim link, view opens search", () => {
    renderApp();
    connect();
    const opened = vi.fn();
    window.addEventListener(OPEN_COMMAND_PALETTE, opened);
    tap(1);
    expect(push).toHaveBeenLastCalledWith("/dashboard/save_test/team");
    tap(9);
    expect(onSim).toHaveBeenCalledTimes(1);
    tap(8);
    window.removeEventListener(OPEN_COMMAND_PALETTE, opened);
    expect(opened).toHaveBeenCalledTimes(1);
  });

  it("does nothing while a simulation is pending", () => {
    renderApp({ pending: true });
    connect();
    screen.getByRole("link", { name: "A" }).focus();
    tap(15);
    tap(0);
    tap(5);
    tap(9);
    tap(1);
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "A" }),
    );
    expect(onTile).not.toHaveBeenCalled();
    expect(onSim).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("ignores pads without the standard mapping", () => {
    mapping = "";
    renderApp();
    connect();
    screen.getByRole("link", { name: "A" }).focus();
    tap(0);
    tap(15);
    expect(onTile).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(
      screen.getByRole("link", { name: "A" }),
    );
  });

  it("leaves left/right and the rest to a focused text field", () => {
    render(
      <SimulationActivityProvider>
        <GamepadBridge />
        <input aria-label="Filter" />
      </SimulationActivityProvider>,
    );
    connect();
    const input = screen.getByRole("textbox", { name: "Filter" });
    input.focus();
    const keys: string[] = [];
    input.addEventListener("keydown", (e) => keys.push(e.key));
    tap(14);
    tap(15);
    tap(13);
    tap(12);
    tap(0);
    tap(5);
    expect(keys).toEqual(["ArrowDown", "ArrowUp"]);
  });

  it("stops polling when the last pad disconnects", () => {
    renderApp();
    connect();
    expect(queued.size).toBe(1);
    connected = false;
    act(() => {
      window.dispatchEvent(new Event("gamepaddisconnected"));
    });
    expect(queued.size).toBe(0);
    const calls = rafSpy.mock.calls.length;
    pump();
    expect(rafSpy.mock.calls.length).toBe(calls);
  });

  it("marks the input mode as gamepad after a pad action", () => {
    renderApp();
    connect();
    setInputMode("pointer");
    tap(13);
    expect(document.documentElement.dataset.input).toBe("gamepad");
  });
});

describe("ControlLegend input modes", () => {
  it("shows key caps by default and pad glyphs in gamepad mode", () => {
    renderApp();
    const legend = screen.getByRole("contentinfo", {
      name: "Keyboard controls",
    });
    expect(legend.querySelector("kbd")).not.toBeNull();
    expect(legend.querySelector("[data-pad-hint]")).toBeNull();

    act(() => setInputMode("gamepad"));
    const pad = screen.getByRole("contentinfo", { name: "Gamepad controls" });
    expect(pad.querySelector("kbd")).toBeNull();
    const labels = [...pad.querySelectorAll("[data-pad-hint]")].map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(["Hubs", "Move", "Select", "Back", "Sim", "Search"]);
    expect(pad.querySelectorAll("svg[aria-hidden='true']").length).toBe(6);

    act(() => setInputMode("keyboard"));
    expect(
      screen.getByRole("contentinfo", { name: "Keyboard controls" }),
    ).toBeTruthy();
  });
});
