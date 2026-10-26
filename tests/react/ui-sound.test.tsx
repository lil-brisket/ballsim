import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard/s",
}));
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import {
  SOUND_STORAGE_KEY,
  getSoundSettings,
  resetSoundSettingsForTests,
  updateSoundSettings,
} from "@/components/ui/sound/sound-settings";
import {
  playUiSound,
  setAudioContextFactory,
} from "@/components/ui/sound/ui-sound";
import { ControlLegend } from "@/components/game/shell/ControlLegend";
import { FocusGrid } from "@/components/ui/focus/FocusGrid";
import { SimulationSummaryModal } from "@/components/calendar/SimulationSummaryModal";
import {
  SimulationActivityProvider,
  useSimulationActivity,
} from "@/components/game/simulation-activity";

function fakeContext() {
  const node = () => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    type: "",
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    start: vi.fn(),
    stop: vi.fn(),
  });
  return {
    currentTime: 0,
    state: "running",
    destination: {},
    createOscillator: vi.fn(node),
    createGain: vi.fn(node),
    createBiquadFilter: vi.fn(node),
    resume: vi.fn(() => Promise.resolve()),
  };
}

let created: ReturnType<typeof fakeContext>[] = [];

function installFakeAudio() {
  created = [];
  setAudioContextFactory(() => {
    const ctx = fakeContext();
    created.push(ctx);
    return ctx as unknown as AudioContext;
  });
}

function mockMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduce && query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  resetSoundSettingsForTests();
  installFakeAudio();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setAudioContextFactory(null);
  window.localStorage.clear();
  resetSoundSettingsForTests();
});

describe("sound settings", () => {
  it("defaults to off at half volume", () => {
    expect(getSoundSettings()).toEqual({ enabled: false, volume: 0.5 });
  });

  it("persists and reloads from localStorage", () => {
    updateSoundSettings({ enabled: true, volume: 0.8 });
    expect(JSON.parse(window.localStorage.getItem(SOUND_STORAGE_KEY)!)).toEqual(
      { enabled: true, volume: 0.8 },
    );
    resetSoundSettingsForTests();
    expect(getSoundSettings()).toEqual({ enabled: true, volume: 0.8 });
  });

  it("falls back to defaults on corrupt storage", () => {
    window.localStorage.setItem(SOUND_STORAGE_KEY, "{not json");
    resetSoundSettingsForTests();
    expect(getSoundSettings()).toEqual({ enabled: false, volume: 0.5 });
  });

  it("does not throw when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    resetSoundSettingsForTests();
    expect(getSoundSettings().enabled).toBe(false);
    expect(() => updateSoundSettings({ enabled: true })).not.toThrow();
    expect(getSoundSettings().enabled).toBe(true);
  });

  it("syncs from another tab through the storage event", () => {
    render(<ControlLegend hubCount={5} />);
    expect(screen.getByRole("button", { name: "Sound: Off" })).toBeTruthy();
    act(() => {
      window.localStorage.setItem(
        SOUND_STORAGE_KEY,
        JSON.stringify({ enabled: true, volume: 0.2 }),
      );
      window.dispatchEvent(
        new StorageEvent("storage", { key: SOUND_STORAGE_KEY }),
      );
    });
    expect(screen.getByRole("button", { name: "Sound: On" })).toBeTruthy();
  });
});

describe("playUiSound", () => {
  it("is a no-op while disabled and creates no AudioContext", () => {
    playUiSound("select");
    expect(created).toHaveLength(0);
  });

  it("is a no-op without Web Audio", () => {
    setAudioContextFactory(() => null);
    updateSoundSettings({ enabled: true });
    expect(() => playUiSound("move")).not.toThrow();
  });

  it("creates one context lazily and reuses it", () => {
    updateSoundSettings({ enabled: true });
    expect(created).toHaveLength(0);
    playUiSound("move");
    playUiSound("sting");
    playUiSound("simDone");
    expect(created).toHaveLength(1);
    expect(created[0]!.createOscillator).toHaveBeenCalled();
  });

  it("stays silent until the viewer has interacted with the page", () => {
    updateSoundSettings({ enabled: true });
    const activation = { hasBeenActive: false };
    Object.defineProperty(navigator, "userActivation", {
      value: activation,
      configurable: true,
    });
    try {
      playUiSound("sting");
      expect(created).toHaveLength(0);
      activation.hasBeenActive = true;
      playUiSound("sting");
      expect(created).toHaveLength(1);
    } finally {
      delete (navigator as { userActivation?: unknown }).userActivation;
    }
  });
});

describe("sound toggle", () => {
  it("flips aria-pressed, persists, and confirms with a sound", () => {
    render(<ControlLegend hubCount={5} />);
    const toggle = screen.getByRole("button", { name: "Sound: Off" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    expect(created).toHaveLength(0);
    fireEvent.click(toggle);
    const on = screen.getByRole("button", { name: "Sound: On" });
    expect(on.getAttribute("aria-pressed")).toBe("true");
    expect(
      JSON.parse(window.localStorage.getItem(SOUND_STORAGE_KEY)!).enabled,
    ).toBe(true);
    expect(created).toHaveLength(1);
    fireEvent.click(on);
    expect(
      screen
        .getByRole("button", { name: "Sound: Off" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("disables the volume slider while sound is off", () => {
    render(<ControlLegend hubCount={5} />);
    fireEvent.click(screen.getByRole("button", { name: "Controls" }));
    const slider = screen.getByLabelText("Sound volume") as HTMLInputElement;
    expect(slider.disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Sound: Off" }));
    expect(slider.disabled).toBe(false);
    fireEvent.change(slider, { target: { value: "20" } });
    expect(getSoundSettings().volume).toBeCloseTo(0.2);
  });
});

describe("focus move cue", () => {
  function placeTiles() {
    const positions: Record<string, [number, number]> = {
      A: [0, 0],
      B: [110, 0],
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

  it("plays move only when focus actually moved", () => {
    updateSoundSettings({ enabled: true });
    render(
      <FocusGrid aria-label="Tiles">
        <a href="/A" data-focus-item="">
          A
        </a>
        <a href="/B" data-focus-item="">
          B
        </a>
      </FocusGrid>,
    );
    placeTiles();
    const a = screen.getByRole("link", { name: "A" });
    a.focus();
    expect(created).toHaveLength(0);
    fireEvent.keyDown(a, { key: "ArrowRight" });
    expect(created).toHaveLength(1);
    const oscillators = created[0]!.createOscillator.mock.calls.length;
    expect(oscillators).toBe(1);
    const b = screen.getByRole("link", { name: "B" });
    fireEvent.keyDown(b, { key: "ArrowRight" });
    expect(created[0]!.createOscillator.mock.calls.length).toBe(oscillators);
  });
});

describe("sim moment", () => {
  const baseProps = {
    open: true,
    daysAdvanced: 1,
    highlightCount: 0,
    returnPath: "/dashboard/s/calendar",
    recentHighlights: [],
    saveId: "s",
  };

  it("flashes WIN for a win, aria-hidden, then fades away", () => {
    vi.useFakeTimers();
    mockMotion(false);
    render(
      <SimulationSummaryModal
        {...baseProps}
        teamGames={[{ date: "2026-10-20", headline: "W 112–104 vs SAC" }]}
      />,
    );
    const moment = screen.getByTestId("sim-moment");
    expect(moment.getAttribute("aria-hidden")).toBe("true");
    expect(moment.getAttribute("data-tone")).toBe("win");
    expect(moment.textContent).toBe("Win");
    expect(screen.getByRole("dialog")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.queryByTestId("sim-moment")).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("flashes LOSS for a loss", () => {
    mockMotion(false);
    render(
      <SimulationSummaryModal
        {...baseProps}
        teamGames={[{ date: "2026-10-20", headline: "L 90–101 vs SAC" }]}
      />,
    );
    expect(screen.getByTestId("sim-moment").getAttribute("data-tone")).toBe(
      "loss",
    );
  });

  it("draws nothing under reduced motion", () => {
    mockMotion(true);
    render(
      <SimulationSummaryModal
        {...baseProps}
        teamGames={[{ date: "2026-10-20", headline: "W 112–104 vs SAC" }]}
      />,
    );
    expect(screen.queryByTestId("sim-moment")).toBeNull();
    expect(screen.getByLabelText("Win")).toBeTruthy();
  });

  it("plays the sting once when sound is on, also under reduced motion", () => {
    mockMotion(true);
    updateSoundSettings({ enabled: true });
    render(
      <SimulationSummaryModal
        {...baseProps}
        teamGames={[{ date: "2026-10-20", headline: "W 112–104 vs SAC" }]}
      />,
    );
    expect(created).toHaveLength(1);
    // Three chord notes, two oscillators each.
    expect(created[0]!.createOscillator).toHaveBeenCalledTimes(6);
  });
});

describe("nothing plays on mount", () => {
  function Probe() {
    const { setSimulationPending } = useSimulationActivity();
    return (
      <button type="button" onClick={() => setSimulationPending(true)}>
        go
      </button>
    );
  }

  it("stays silent when shell pieces mount with sound enabled", () => {
    updateSoundSettings({ enabled: true });
    render(
      <SimulationActivityProvider initialPending>
        <ControlLegend hubCount={5} />
        <FocusGrid>
          <a href="/A" data-focus-item="">
            A
          </a>
        </FocusGrid>
      </SimulationActivityProvider>,
    );
    expect(created).toHaveLength(0);
  });

  it("plays simStart only when pending turns on", () => {
    updateSoundSettings({ enabled: true });
    render(
      <SimulationActivityProvider>
        <Probe />
      </SimulationActivityProvider>,
    );
    expect(created).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "go" }));
    expect(created).toHaveLength(1);
  });
});
