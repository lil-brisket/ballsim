import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  MomentOverlay,
  MomentReplayButton,
  momentKey,
  useMomentGate,
  type MomentStep,
} from "@/components/moments";
import { resetMomentsForTests } from "@/components/moments/moment-seen";
import {
  resetSoundSettingsForTests,
  updateSoundSettings,
} from "@/components/ui/sound/sound-settings";
import { setAudioContextFactory } from "@/components/ui/sound/ui-sound";

const STEPS: readonly MomentStep[] = [
  { id: "one", title: "First step" },
  { id: "two", title: "Second step" },
  { id: "three", title: "Third step", sting: true },
];
const SUMMARY = { id: "summary", title: "Whole moment" };

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

let audioContexts = 0;
function installFakeAudio() {
  audioContexts = 0;
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
  setAudioContextFactory(() => {
    audioContexts += 1;
    return {
      currentTime: 0,
      state: "running",
      destination: {},
      createOscillator: vi.fn(node),
      createGain: vi.fn(node),
      createBiquadFilter: vi.fn(node),
      resume: vi.fn(() => Promise.resolve()),
    } as unknown as AudioContext;
  });
}

/** A page with a replay button and an auto-opening moment. */
function Harness(props: { eligible?: boolean; saveId?: string }) {
  const gate = useMomentGate(
    props.saveId ?? "save_1",
    momentKey("demo", "team_1", 2027),
    { eligible: props.eligible ?? true },
  );
  return (
    <>
      <MomentReplayButton onReplay={gate.replay} label="Replay demo" />
      <MomentOverlay
        open={gate.open}
        onClose={gate.close}
        label="Demo moment"
        steps={STEPS}
        summary={SUMMARY}
      />
    </>
  );
}

const heading = () => screen.getByRole("heading", { level: 2 });

beforeEach(() => {
  window.localStorage.clear();
  resetMomentsForTests();
  resetSoundSettingsForTests();
  installFakeAudio();
  mockMotion(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setAudioContextFactory(null);
  window.localStorage.clear();
  resetMomentsForTests();
  resetSoundSettingsForTests();
});

describe("MomentOverlay", () => {
  it("is a labelled modal dialog that starts on Next", () => {
    render(
      <MomentOverlay
        open
        onClose={() => {}}
        label="Demo moment"
        steps={STEPS}
        summary={SUMMARY}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Demo moment" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Next/ }),
    );
    expect(heading().textContent).toContain("First step");
  });

  it("steps forward with Next and closes on Done", () => {
    const onClose = vi.fn();
    render(
      <MomentOverlay
        open
        onClose={onClose}
        label="Demo moment"
        steps={STEPS}
        summary={SUMMARY}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
    expect(heading().textContent).toContain("Second step");
    expect(screen.getByText("2 / 3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
    expect(heading().textContent).toContain("Third step");
    // Last step: Done, no Skip.
    expect(screen.queryByRole("button", { name: /^Skip all/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^Done/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("announces each step politely", () => {
    render(
      <MomentOverlay
        open
        onClose={() => {}}
        label="Demo moment"
        steps={STEPS}
        summary={SUMMARY}
      />,
    );
    const live = document.querySelector('[aria-live="polite"]')!;
    expect(live.textContent).toBe("Step 1 of 3: First step");
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
    expect(live.textContent).toBe("Step 2 of 3: Second step");
  });

  it("skips all with the button and with Escape", () => {
    const onClose = vi.fn();
    render(
      <MomentOverlay
        open
        onClose={onClose}
        label="Demo moment"
        steps={STEPS}
        summary={SUMMARY}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Skip all/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not advance by itself unless asked", () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <MomentOverlay
        open
        onClose={() => {}}
        label="Demo moment"
        steps={STEPS}
        summary={SUMMARY}
      />,
    );
    act(() => vi.advanceTimersByTime(30_000));
    expect(heading().textContent).toContain("First step");

    rerender(
      <MomentOverlay
        open
        onClose={() => {}}
        label="Demo moment"
        steps={STEPS}
        summary={SUMMARY}
        autoAdvanceMs={1_000}
      />,
    );
    act(() => vi.advanceTimersByTime(1_000));
    expect(heading().textContent).toContain("Second step");
  });

  it("shows one static summary card under reduced motion", () => {
    mockMotion(true);
    vi.useFakeTimers();
    render(
      <MomentOverlay
        open
        onClose={() => {}}
        label="Demo moment"
        steps={STEPS}
        summary={SUMMARY}
        autoAdvanceMs={1_000}
      />,
    );
    expect(heading().textContent).toContain("Whole moment");
    expect(screen.queryByText("First step")).toBeNull();
    expect(screen.getByRole("button", { name: /^Done/ })).toBeTruthy();
    act(() => vi.advanceTimersByTime(5_000));
    expect(heading().textContent).toContain("Whole moment");
  });

  it("plays nothing with sound off and cues with sound on", () => {
    const { unmount } = render(
      <MomentOverlay
        open
        onClose={() => {}}
        label="Demo moment"
        steps={STEPS}
        summary={SUMMARY}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Next/ }));
    expect(audioContexts).toBe(0);
    unmount();

    updateSoundSettings({ enabled: true });
    render(
      <MomentOverlay
        open
        onClose={() => {}}
        label="Demo moment"
        steps={STEPS}
        summary={SUMMARY}
      />,
    );
    expect(audioContexts).toBeGreaterThan(0);
  });
});

describe("useMomentGate", () => {
  it("auto-opens once, then never again for the same key", () => {
    const first = render(<Harness />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    first.unmount();

    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is remembered per save in localStorage", () => {
    const first = render(<Harness />);
    fireEvent.keyDown(document, { key: "Escape" });
    first.unmount();
    expect(
      window.localStorage.getItem("ballsim:moment:save_1:demo:team_1:2027"),
    ).toBe("1");

    render(<Harness saveId="save_2" />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("counts an auto-open as seen even if the page goes away mid-moment", () => {
    const first = render(<Harness />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    first.unmount();
    // A reload: memory is gone, storage is not.
    resetMomentsForTests();
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not auto-open when the facts are not there", () => {
    render(<Harness eligible={false} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("still works when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const first = render(<Harness />);
    fireEvent.keyDown(document, { key: "Escape" });
    first.unmount();
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("replays on demand and returns focus to the replay button", () => {
    render(<Harness eligible={false} />);
    const replay = screen.getByRole("button", { name: /Replay demo/ });
    replay.focus();
    fireEvent.click(replay);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Next/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Skip all/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(replay);
  });
});
