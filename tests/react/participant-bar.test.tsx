import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const switchParticipantAction = vi.fn();
const setParticipantReadyAction = vi.fn();
const readyAllParticipantsAction = vi.fn();
const setParticipantAutoManagedAction = vi.fn();

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

vi.mock("@/application/actions/online-league", () => ({
  setParticipantAutoManagedAction: (...a: unknown[]) =>
    setParticipantAutoManagedAction(...a),
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
    approvalWindow: null,
    autoManageAfterDays: null,
    participants: [
      {
        id: "p1",
        displayName: "Alex",
        isHost: true,
        isActive: activeId === "p1",
        isReady: false,
        teamIds: ["t1"],
        plannedTeamCount: 1,
        lastActiveAt: null,
        autoManaged: null,
      },
      {
        id: "p2",
        displayName: "Sam",
        isHost: false,
        isActive: activeId === "p2",
        isReady: true,
        teamIds: ["t2"],
        plannedTeamCount: 1,
        lastActiveAt: null,
        autoManaged: null,
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
      setParticipantAutoManagedAction,
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
    // The commissioner approves by advancing, so has no ready toggle.
    expect(screen.queryByRole("button", { name: "I'm ready" })).toBeNull();
    unmount();
  });

  describe("online league", () => {
    function onlineParticipation(
      activeId: string,
      memberCount: number,
      overrides: Partial<Participation> = {},
    ): Participation {
      const participants: Participation["participants"] = [
        {
          id: "host",
          displayName: "Casey",
          isHost: true,
          isActive: activeId === "host",
          isReady: false,
          teamIds: ["t0"],
          plannedTeamCount: 1,
          lastActiveAt: null,
          autoManaged: null,
        },
        ...Array.from({ length: memberCount }, (_, i) => ({
          id: `m${i + 1}`,
          displayName: `Member${i + 1}`,
          isHost: false,
          isActive: activeId === `m${i + 1}`,
          isReady: false,
          teamIds: [`t${i + 1}`],
          plannedTeamCount: 1,
          lastActiveAt: null,
          autoManaged: null,
        })),
      ];
      return {
        mode: "online",
        activeParticipantId: activeId,
        assignmentsConfirmed: true,
        advanceBlockedReason: null,
        approvalWindow: null,
        autoManageAfterDays: null,
        participants,
        ...overrides,
      };
    }

    it("labels the host Commissioner", () => {
      const { container, unmount } = render(
        <ParticipantBar
          saveId="save123"
          participation={onlineParticipation("host", 2)}
        />,
      );
      expect(container.textContent).toContain("Commissioner");
      unmount();
    });

    it("shows a compact summary with truncated waiting names", () => {
      const base = onlineParticipation("host", 8);
      base.participants[1]!.isReady = true;
      base.participants[2]!.autoManaged = {
        since: "2026-10-01T00:00:00.000Z",
        reason: "inactive",
      };
      const { container, unmount } = render(
        <ParticipantBar saveId="save123" participation={base} />,
      );
      const text = container.textContent ?? "";
      // Members only: the commissioner and the AI-managed member are not counted.
      expect(text).toContain("1 of 7 ready");
      expect(text).toContain(
        "Member3, Member4, Member5, Member6, Member7 and 1 more",
      );
      expect(text).not.toContain("Member1:");
      expect(text).toContain("1 AI-managed");
      unmount();
    });

    it("uses approval wording while a window is open", () => {
      const { container, unmount } = render(
        <ParticipantBar
          saveId="save123"
          participation={onlineParticipation("m1", 2, {
            approvalWindow: {
              openedAt: "2026-10-26T10:00:00.000Z",
              closesAt: "2026-10-27T10:00:00.000Z",
              closed: false,
            },
          })}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Approve advance" }),
      ).toBeTruthy();
      expect(container.textContent).toContain("Approval closes");
      expect(container.querySelector("time")?.getAttribute("datetime")).toBe(
        "2026-10-27T10:00:00.000Z",
      );
      unmount();
    });

    it("shows the closed-window message", () => {
      const { container, unmount } = render(
        <ParticipantBar
          saveId="save123"
          participation={onlineParticipation("m1", 2, {
            approvalWindow: {
              openedAt: "2026-10-25T10:00:00.000Z",
              closesAt: "2026-10-26T09:00:00.000Z",
              closed: true,
            },
          })}
        />,
      );
      expect(container.textContent).toContain(
        "Approval window closed. The commissioner can advance; members who did not approve will be AI-managed.",
      );
      unmount();
    });

    it("shows the auto-managed banner and lets the member take back control", async () => {
      const p = onlineParticipation("m1", 2, {
        advanceBlockedReason:
          "Only the commissioner (Casey) can advance the league.",
      });
      p.participants[1]!.autoManaged = {
        since: "2026-10-01T00:00:00.000Z",
        reason: "missed_approval",
      };
      const { container, unmount } = render(
        <ParticipantBar saveId="save123" participation={p} />,
      );
      expect(container.textContent).toContain("The AI is managing your teams");
      expect(container.textContent).toContain("you missed the approval window");
      expect(screen.queryByRole("button", { name: "I'm ready" })).toBeNull();
      const blocked = screen.getByText(/Only the commissioner/);
      expect(blocked.className).toContain("text-zinc-400");
      fireEvent.click(
        screen.getByRole("button", { name: "Take back control" }),
      );
      await waitFor(() =>
        expect(setParticipantAutoManagedAction).toHaveBeenCalled(),
      );
      const fd = setParticipantAutoManagedAction.mock.calls[0]![0] as FormData;
      expect(fd.get("participantId")).toBe("m1");
      expect(fd.get("autoManaged")).toBe("false");
      expect(fd.get("returnPath")).toBe("/dashboard/save123/roster?year=2026");
      unmount();
    });

    it("keeps the flat list for local shared leagues", () => {
      const { container, unmount } = render(
        <ParticipantBar saveId="save123" participation={participation("p1")} />,
      );
      expect(container.textContent).toContain("Host");
      expect(container.textContent).not.toContain("Commissioner");
      expect(container.textContent).not.toContain("of 2 ready");
      expect(container.textContent).toContain("Sam: ✓ ready");
      unmount();
    });
  });
});
