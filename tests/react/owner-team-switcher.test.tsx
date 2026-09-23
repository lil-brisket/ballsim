import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const navigationState = {
  pathname: "/dashboard/save123/roster",
  search: "",
};

const switchActiveOwnerTeamAction = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
  useSearchParams: () => new URLSearchParams(navigationState.search),
}));

vi.mock("@/application/actions", () => ({
  switchActiveOwnerTeamAction: (...args: unknown[]) =>
    switchActiveOwnerTeamAction(...args),
}));

import {
  OwnerTeamSwitcher,
  buildOwnerReturnPath,
} from "@/components/game/OwnerTeamSwitcher";
import type { DashboardSnapshot } from "@/state/selectors";

type OwnedTeam = DashboardSnapshot["ownedTeams"][number];

function ownedTeam(
  overrides: Partial<OwnedTeam> & Pick<OwnedTeam, "id" | "city" | "name">,
): OwnedTeam {
  return {
    abbreviation:
      overrides.abbreviation ?? overrides.name.slice(0, 3).toUpperCase(),
    branding: {
      primaryColor: "#1a1a2e",
      secondaryColor: "#eaeaea",
      accentColor: "#f59e0b",
      logoId: "shield",
    },
    wins: 10,
    losses: 5,
    isActive: false,
    blockingDecisionCount: 0,
    unreadNotificationCount: 0,
    ...overrides,
  };
}

const multiTeam = () => [
  ownedTeam({
    id: "team_a",
    city: "Toronto",
    name: "Huskies",
    isActive: true,
  }),
  ownedTeam({
    id: "team_b",
    city: "Vancouver",
    name: "Wolves",
    isActive: false,
  }),
];

async function switchToWolves(saveId = "save123") {
  const { unmount } = render(
    <OwnerTeamSwitcher saveId={saveId} ownedTeams={multiTeam()} />,
  );
  fireEvent.click(screen.getByRole("button", { name: /switch franchise/i }));
  fireEvent.click(screen.getByRole("option", { name: /Vancouver Wolves/i }));
  await waitFor(() => {
    expect(switchActiveOwnerTeamAction).toHaveBeenCalled();
  });
  return unmount;
}

describe("buildOwnerReturnPath", () => {
  it("preserves durable query params and strips transient flash params", () => {
    const params = new URLSearchParams(
      "year=2026&month=11&date=2026-11-01&error=boom&simSummary=1&daysAdvanced=3&highlights=2&fromDate=2026-11-01&team=my",
    );
    expect(
      buildOwnerReturnPath("/dashboard/save123/calendar", params),
    ).toBe(
      "/dashboard/save123/calendar?year=2026&month=11&date=2026-11-01&team=my",
    );
  });

  it("returns pathname alone when no durable params remain", () => {
    expect(
      buildOwnerReturnPath(
        "/dashboard/save123/roster",
        new URLSearchParams("error=nope"),
      ),
    ).toBe("/dashboard/save123/roster");
  });
});

describe("OwnerTeamSwitcher", () => {
  beforeEach(() => {
    switchActiveOwnerTeamAction.mockReset();
    switchActiveOwnerTeamAction.mockResolvedValue(undefined);
    navigationState.pathname = "/dashboard/save123/roster";
    navigationState.search = "";
  });

  it("renders display-only control when the user owns a single team", () => {
    const teams = [
      ownedTeam({
        id: "team_a",
        city: "Toronto",
        name: "Huskies",
        isActive: true,
      }),
    ];
    const { unmount } = render(
      <OwnerTeamSwitcher saveId="save123" ownedTeams={teams} />,
    );
    expect(screen.getByText("Toronto Huskies")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("listbox")).toBeNull();
    unmount();
  });

  it("opens franchise list when multiple teams are owned", () => {
    const { unmount } = render(
      <OwnerTeamSwitcher saveId="save123" ownedTeams={multiTeam()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /switch franchise/i }));
    expect(screen.getByRole("listbox")).toBeTruthy();
    expect(
      screen.getByRole("option", { name: /Vancouver Wolves/i }),
    ).toBeTruthy();
    unmount();
  });

  it("submits returnPath for the current roster route when switching", async () => {
    navigationState.pathname = "/dashboard/save123/roster";
    const unmount = await switchToWolves();
    const formData = switchActiveOwnerTeamAction.mock.calls[0]![0] as FormData;
    expect(formData.get("saveId")).toBe("save123");
    expect(formData.get("teamId")).toBe("team_b");
    expect(formData.get("returnPath")).toBe("/dashboard/save123/roster");
    expect(formData.get("returnPath")).not.toBe("/dashboard/save123");
    unmount();
  });

  it("submits returnPath for the current finances route when switching", async () => {
    navigationState.pathname = "/dashboard/save123/finances";
    const unmount = await switchToWolves();
    const formData = switchActiveOwnerTeamAction.mock.calls[0]![0] as FormData;
    expect(formData.get("returnPath")).toBe("/dashboard/save123/finances");
    expect(formData.get("returnPath")).not.toBe("/dashboard/save123");
    unmount();
  });

  it("preserves durable query params on returnPath", async () => {
    navigationState.pathname = "/dashboard/save123/calendar";
    navigationState.search = "year=2026&month=11&error=stale&simSummary=1";
    const unmount = await switchToWolves();
    const formData = switchActiveOwnerTeamAction.mock.calls[0]![0] as FormData;
    expect(formData.get("returnPath")).toBe(
      "/dashboard/save123/calendar?year=2026&month=11",
    );
    unmount();
  });
});
