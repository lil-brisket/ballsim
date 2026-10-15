import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const actionMock = vi.hoisted(() => vi.fn());

vi.mock("@/application/actions", () => ({
  confirmControlledFranchisesAction: actionMock,
}));

import { OwnerMultiTeamPick } from "@/components/owner/OwnerMultiTeamPick";
import type { TeamListEntry } from "@/state/selectors";

function team(id: string, city: string, name: string): TeamListEntry {
  return {
    id,
    city,
    name,
    abbreviation: id.toUpperCase().slice(0, 3),
    conferenceId: "c1",
    divisionId: "d1",
    conferenceName: "East",
    divisionName: "Atlantic",
    branding: null,
  };
}

const TEAMS: TeamListEntry[] = [
  team("ta", "Austin", "Foxes"),
  team("tb", "Boston", "Herons"),
  team("tc", "Chicago", "Otters"),
  team("td", "Denver", "Lynx"),
];

const PARTICIPANTS = [
  { id: "p_alex", displayName: "Alex", isHost: true, plannedTeamCount: 1 },
  { id: "p_sam", displayName: "Sam", isHost: false, plannedTeamCount: 2 },
];

function submitButton(): HTMLButtonElement {
  return screen.getByRole("button", {
    name: /Continue with 3 franchises/,
  }) as HTMLButtonElement;
}

function managedBy(label: string): HTMLSelectElement {
  return screen.getByLabelText(`Managed by for ${label}`) as HTMLSelectElement;
}

function payload() {
  expect(actionMock).toHaveBeenCalledTimes(1);
  const formData = actionMock.mock.calls[0][0] as FormData;
  return JSON.parse(String(formData.get("franchisesJson"))) as Array<
    Record<string, unknown>
  >;
}

beforeEach(() => {
  actionMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("OwnerMultiTeamPick with participants", () => {
  it("fixes the anchor team to the host", () => {
    const { unmount } = render(
      <OwnerMultiTeamPick
        saveId="s1"
        anchorTeamId="ta"
        controlledTeamCount={3}
        teams={TEAMS}
        participants={PARTICIPANTS}
      />,
    );
    const select = managedBy("Austin Foxes");
    expect(select.disabled).toBe(true);
    expect(select.value).toBe("p_alex");
    expect(screen.getByTestId("participant-progress").textContent).toBe(
      "Alex (host): 1 of 1 · Sam: 0 of 2",
    );
    unmount();
  });

  it("defaults a newly selected team to the participant needing teams", () => {
    const { unmount } = render(
      <OwnerMultiTeamPick
        saveId="s1"
        anchorTeamId="ta"
        controlledTeamCount={3}
        teams={TEAMS}
        participants={PARTICIPANTS}
      />,
    );
    fireEvent.click(screen.getByLabelText("Control Boston Herons"));
    const select = managedBy("Boston Herons");
    expect(select.value).toBe("p_sam");
    expect(select.disabled).toBe(false);
    expect(screen.getByTestId("participant-progress").textContent).toBe(
      "Alex (host): 1 of 1 · Sam: 1 of 2",
    );

    fireEvent.click(screen.getByLabelText("Control Boston Herons"));
    expect(screen.queryByLabelText("Managed by for Boston Herons")).toBeNull();
    expect(screen.getByTestId("participant-progress").textContent).toBe(
      "Alex (host): 1 of 1 · Sam: 0 of 2",
    );
    unmount();
  });

  it("blocks submit until counts match and sends participantIds", () => {
    const { unmount } = render(
      <OwnerMultiTeamPick
        saveId="s1"
        anchorTeamId="ta"
        controlledTeamCount={3}
        teams={TEAMS}
        participants={PARTICIPANTS}
      />,
    );
    fireEvent.click(screen.getByLabelText("Control Boston Herons"));
    fireEvent.click(screen.getByLabelText("Control Chicago Otters"));
    expect(submitButton().disabled).toBe(false);

    // Give Sam's second team to Alex: Alex 2 of 1, Sam 1 of 2.
    fireEvent.change(managedBy("Chicago Otters"), {
      target: { value: "p_alex" },
    });
    expect(submitButton().disabled).toBe(true);
    expect(
      screen
        .getAllByRole("status")
        .some((el) => /Sam has 1 of 2/.test(el.textContent ?? "")),
    ).toBe(true);

    fireEvent.change(managedBy("Chicago Otters"), {
      target: { value: "p_sam" },
    });
    expect(submitButton().disabled).toBe(false);
    fireEvent.click(submitButton());

    const franchises = payload();
    expect(franchises.map((f) => [f.teamId, f.participantId])).toEqual([
      ["ta", "p_alex"],
      ["tb", "p_sam"],
      ["tc", "p_sam"],
    ]);
    unmount();
  });
});

describe("OwnerMultiTeamPick single player", () => {
  it("renders no assignment UI and omits participantId", () => {
    const { unmount } = render(
      <OwnerMultiTeamPick
        saveId="s1"
        anchorTeamId="ta"
        controlledTeamCount={1}
        teams={TEAMS}
      />,
    );
    expect(screen.queryByLabelText(/Managed by/)).toBeNull();
    expect(screen.queryByTestId("participant-progress")).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue to dashboard" }),
    );
    const franchises = payload();
    expect(franchises).toHaveLength(1);
    expect("participantId" in franchises[0]).toBe(false);
    expect(Object.keys(franchises[0]).sort()).toEqual([
      "accentColor",
      "logoId",
      "nickname",
      "primaryColor",
      "secondaryColor",
      "teamId",
    ]);
    unmount();
  });
});
