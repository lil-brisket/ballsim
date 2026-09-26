import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const fetchStaff = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/save_test/staff-coaching/staff",
}));

vi.mock("@/application/actions", () => ({
  makeStaffOfferAction: vi.fn(),
  negotiateStaffOfferAction: vi.fn(),
  acceptStaffOfferAction: vi.fn(),
  fireStaffAction: vi.fn(),
  renewStaffContractAction: vi.fn(),
  fetchStaffDrawerViewAction: (...args: unknown[]) => fetchStaff(...args),
  fetchPlayerDrawerViewAction: vi.fn(),
  fetchTeamDrawerViewAction: vi.fn(),
}));

import { EntityDrawerProvider } from "@/components/entity/EntityDrawerProvider";
import { StaffCoachingNav } from "@/components/staff-coaching/StaffCoachingNav";
import { StaffPageView } from "@/components/staff-coaching/StaffPageView";
import { HiringMarketPageView } from "@/components/staff-coaching/HiringMarketPageView";
import type { StaffHubView } from "@/state/staff-hub-selectors";
import type { StaffHiringMarketView } from "@/state/staff-hub-selectors";
import type { StaffMemberView } from "@/state/franchise-selectors";

const member: StaffMemberView = {
  staffId: "staff_hc",
  firstName: "John",
  lastName: "Smith",
  role: "head_coach",
  roleLabel: "Head Coach",
  overall: 82,
  potential: 85,
  age: 48,
  experience: 17,
  strengths: ["Leadership"],
  weaknesses: ["Adaptability"],
  employed: true,
  annualSalary: 2_800_000,
  contractEndYear: 2028,
  yearsRemaining: 3,
  trend: "stable",
  morale: 70,
  desiredSalary: 2_800_000,
  minimumSalary: 2_000_000,
  specialty: "Player Development",
};

const freeAgent: StaffMemberView = {
  ...member,
  staffId: "staff_fa",
  firstName: "Jane",
  lastName: "Scout",
  role: "scout",
  roleLabel: "Scout",
  employed: false,
  annualSalary: null,
  contractEndYear: null,
  yearsRemaining: null,
  specialty: "Player Evaluation",
};

const hub: StaffHubView = {
  saveId: "save_test",
  teamId: "team_1",
  teamName: "Harbor Waves",
  currentDate: "2026-10-01",
  headCoach: member,
  staffCount: 1,
  vacancyCount: 1,
  vacantRoles: ["Medical Staff"],
  vacantRoleEntries: [{ role: "medical", roleLabel: "Medical Staff" }],
  directory: [
    { role: "head_coach", roleLabel: "Head Coach", members: [member] },
  ],
  available: [freeAgent],
  decisions: [],
  budget: {
    payroll: 2_800_000,
    remaining: 9_200_000,
    total: 12_000_000,
    percentageUsed: 23,
    overBudget: false,
    amountOver: 0,
  },
};

const market: StaffHiringMarketView = {
  saveId: "save_test",
  teamId: "team_1",
  freeAgents: [
    {
      ...freeAgent,
      askingInterest: { level: "interested", interested: true },
    },
  ],
  roleFilters: ["head_coach", "scout", "medical"],
  sortOptions: ["overall", "potential", "salary"],
  activeOffers: {},
};

const staffDrawerView = {
  staffId: "staff_hc",
  identity: {
    firstName: "John",
    lastName: "Smith",
    role: "head_coach",
    roleLabel: "Head Coach",
    age: 48,
    overall: 82,
    potential: 88,
  },
  experience: 17,
  attributes: [{ key: "leadership", label: "Leadership", value: 88 }],
  development: { trend: "stable", morale: 70 },
  contract: { salary: 2_800_000, yearsRemaining: 3, endYear: 2028 },
  contractValue: 8_400_000,
  effects: [{ label: "Tempo bonus", value: "+3%" }],
  buyoutAmount: 4_200_000,
  canManage: true,
  strengths: ["Leadership"],
  weaknesses: ["Adaptability"],
  navigation: {
    staffHref: "/dashboard/save_test/staff/staff_hc",
    staffHubHref: "/dashboard/save_test/staff-coaching/staff",
  },
};

describe("staff-coaching UI", () => {
  it("renders Staff / Hiring Market / Coaching tabs", () => {
    const { unmount } = render(<StaffCoachingNav saveId="save_test" />);
    expect(
      screen.getByRole("link", { name: "Staff" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/staff-coaching/staff");
    expect(
      screen.getByRole("link", { name: "Hiring Market" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/staff-coaching/hiring-market");
    expect(
      screen.getByRole("link", { name: "Coaching" }).getAttribute("href"),
    ).toBe("/dashboard/save_test/staff-coaching/coaching");
    unmount();
  });

  it("does not render hiring market content on the staff page", () => {
    const { unmount } = render(<StaffPageView view={hub} />);
    expect(screen.queryByText("Hiring Market")).toBeNull();
    expect(screen.queryByText("Staff Decisions")).toBeNull();
    expect(screen.getByText("Staff Directory")).toBeTruthy();
    expect(screen.getAllByText("John Smith").length).toBeGreaterThan(0);
    const findStaff = screen.getAllByText("Find Staff")[0];
    expect(findStaff?.closest("a")?.getAttribute("href")).toBe(
      "/dashboard/save_test/staff-coaching/hiring-market?role=medical",
    );
    unmount();
  });

  it("renders the free-agent list and URL-driven filters on hiring market", () => {
    const { unmount } = render(
      <HiringMarketPageView
        view={market}
        returnPath="/dashboard/save_test/staff-coaching/hiring-market?role=scout&sort=overall"
        role="scout"
        sort="overall"
      />,
    );
    expect(screen.getByText("Hiring Market")).toBeTruthy();
    expect(screen.getByText("Jane Scout")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Scout" }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Sort: overall" }).getAttribute("href"),
    ).toContain("role=scout");
    unmount();
  });

  it("opens the same staff drawer from the staff page and hiring market", async () => {
    fetchStaff.mockImplementation((_saveId: string, staffId: string) =>
      Promise.resolve({
        ...staffDrawerView,
        staffId,
        identity: {
          ...staffDrawerView.identity,
          firstName: staffId === "staff_fa" ? "Jane" : "John",
          lastName: staffId === "staff_fa" ? "Scout" : "Smith",
        },
        canManage: staffId !== "staff_fa",
        contractValue: staffId === "staff_fa" ? null : 8_400_000,
        contract:
          staffId === "staff_fa"
            ? { salary: null, yearsRemaining: null, endYear: null }
            : staffDrawerView.contract,
        effects: staffId === "staff_fa" ? [] : staffDrawerView.effects,
      }),
    );

    const { unmount } = render(
      <EntityDrawerProvider saveId="save_test">
        <StaffPageView view={hub} />
        <HiringMarketPageView
          view={market}
          returnPath="/dashboard/save_test/staff-coaching/hiring-market"
        />
      </EntityDrawerProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "John Smith" })[0]!);
    await waitFor(() => {
      expect(fetchStaff).toHaveBeenCalledWith("save_test", "staff_hc");
    });
    await waitFor(() => {
      expect(screen.getByText("View full profile")).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    fireEvent.click(screen.getAllByRole("button", { name: "Jane Scout" })[0]!);
    await waitFor(() => {
      expect(fetchStaff).toHaveBeenCalledWith("save_test", "staff_fa");
    });
    await waitFor(() => {
      expect(screen.getByText("View full profile")).toBeTruthy();
    });
    unmount();
  });
});
