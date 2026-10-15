import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const switchParticipantAction = vi.fn();
const setParticipantReadyAction = vi.fn();
const readyAllParticipantsAction = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save123/roster",
  useSearchParams: () => new URLSearchParams("error=x&year=2026"),
}));

vi.mock("@/application/actions", () => ({
  switchParticipantAction: (...a: unknown[]) => switchParticipantAction(...a),
  setParticipantReadyAction: (...a: unknown[]) =>
    setParticipantReadyAction(...a),
  readyAllParticipantsAction: (...a: unknown[]) =>
    readyAllParticipantsAction(...a),
  switchActiveOwnerTeamAction: vi.fn(),
}));

import { ParticipantBar } from "@/components/game/ParticipantBar";
import type { DashboardSnapshot } from "@/state/selectors";

type Participation = NonNullable<DashboardSnapshot["participation"]>;

function participation(
  activeId: "p1" | "p2",
  overrides: Partial<Participation> = {},
): Participation {
  return {
    mode: "local_shared",
    activeParticipantId: activeId,
    assignmentsConfirmed: true,
    advanceBlockedReason: null,
    participants: [
      {
        id: "p1",
        displayName: "Alex",
        isHost: true,
        isActive: activeId === "p1",
        isReady: false,
        teamIds: ["t1"],
        plannedTeamCount: 1,
      },
      {
        id: "p2",
        displayName: "Sam",
        isHost: false,
        isActive: activeId === "p2",
        isReady: true,
        teamIds: ["t2"],
        plannedTeamCount: 1,
      },
    ],
    ...overrides,
  };
}

describe("ParticipantBar", () => {
  beforeEach(() => {
    for (const fn of [
      switchParticipantAction,
      setParticipantReadyAction,
      readyAllParticipantsAction,
    ]) {
      fn.mockReset();
      fn.mockResolvedValue(undefined);
    }
  });

  it("renders nothing for single-player saves", () => {
    const { container, unmount } = render(
      <ParticipantBar saveId="save123" participation={null} />,
    );
    expect(container.innerHTML).toBe("");
    unmount();
  });

  it("shows active player, pass buttons and ready toggle", async () => {
    const { container, unmount } = render(
      <ParticipantBar saveId="save123" participation={participation("p1")} />,
    );
    expect(container.textContent).toContain("Playing as");
    expect(container.textContent).toContain("Alex");
    expect(container.textContent).toContain("Host");
    expect(screen.getByRole("button", { name: /Pass to Sam/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Pass to Alex/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "I'm ready" }));
    await waitFor(() => expect(setParticipantReadyAction).toHaveBeenCalled());
    const fd = setParticipantReadyAction.mock.calls[0]![0] as FormData;
    expect(fd.get("saveId")).toBe("save123");
    expect(fd.get("ready")).toBe("true");
    expect(fd.get("returnPath")).toBe("/dashboard/save123/roster?year=2026");

    unmount();
  });

  it("posts the participant id when passing the device", async () => {
    const { unmount } = render(
      <ParticipantBar saveId="save123" participation={participation("p1")} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Pass to Sam/ }));
    await waitFor(() => expect(switchParticipantAction).toHaveBeenCalled());
    const sw = switchParticipantAction.mock.calls[0]![0] as FormData;
    expect(sw.get("participantId")).toBe("p2");
    unmount();
  });

  it("shows Not ready when the active player is ready", () => {
    const { unmount } = render(
      <ParticipantBar saveId="save123" participation={participation("p2")} />,
    );
    expect(screen.getByRole("button", { name: "Not ready" })).toBeTruthy();
    unmount();
  });

  it("host must confirm before advancing for everyone", async () => {
    const { container, unmount } = render(
      <ParticipantBar saveId="save123" participation={participation("p1")} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Advance for everyone" }),
    );
    expect(readyAllParticipantsAction).not.toHaveBeenCalled();
    expect(container.textContent).toContain("may not have finished");
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, mark everyone ready" }),
    );
    await waitFor(() => expect(readyAllParticipantsAction).toHaveBeenCalled());
    const fd = readyAllParticipantsAction.mock.calls[0]![0] as FormData;
    expect(fd.get("saveId")).toBe("save123");
    unmount();
  });

  it("cancel dismisses the advance confirmation", () => {
    const { unmount } = render(
      <ParticipantBar saveId="save123" participation={participation("p1")} />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Advance for everyone" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("button", { name: "Yes, mark everyone ready" }),
    ).toBeNull();
    expect(readyAllParticipantsAction).not.toHaveBeenCalled();
    unmount();
  });

  it("hides advance for everyone from non-host", () => {
    const { unmount } = render(
      <ParticipantBar saveId="save123" participation={participation("p2")} />,
    );
    expect(
      screen.queryByRole("button", { name: "Advance for everyone" }),
    ).toBeNull();
    unmount();
  });

  it("shows ready states and the blocked reason", () => {
    const { container, unmount } = render(
      <ParticipantBar
        saveId="save123"
        participation={participation("p1", {
          advanceBlockedReason: "Waiting on Alex to press Ready.",
        })}
      />,
    );
    expect(container.textContent).toContain("Sam: ✓ ready");
    expect(container.textContent).toContain("Alex: waiting");
    expect(container.textContent).toContain("Waiting on Alex to press Ready.");
    unmount();
  });

  it("online mode hides pass buttons and links to league members", () => {
    const { container, unmount } = render(
      <ParticipantBar
        saveId="save123"
        participation={participation("p1", { mode: "online" })}
      />,
    );
    expect(container.textContent).toContain("Signed in as");
    expect(container.textContent).not.toContain("Playing as");
    expect(screen.queryByRole("button", { name: /Pass to/ })).toBeNull();
    const link = screen.getByRole("link", { name: "League members" });
    expect(link.getAttribute("href")).toBe("/dashboard/save123/league-members");
    expect(screen.getByRole("button", { name: "I'm ready" })).toBeTruthy();
    unmount();
  });
});
