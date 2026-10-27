import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/application/actions", () => ({
  updateLeagueSettingsAction: vi.fn(),
  renameLeagueAction: vi.fn(),
  setFranchiseAiAssistanceAction: vi.fn(),
  updateCustomRosterPlayerAction: vi.fn(),
  exportRosterAction: vi.fn(),
  exportDraftClassAction: vi.fn(),
}));

import { RosterEditorForm } from "@/components/settings/RosterEditorForm";
import {
  RulesForm,
  type RulesFormValues,
} from "@/components/settings/RulesForm";
import { SeasonFormatForm } from "@/components/settings/SeasonFormatForm";
import { PLAYER_ATTRIBUTE_KEYS } from "@/domain/entities/player";
import type { PlayerAttributes } from "@/domain/entities/player";

afterEach(() => {
  cleanup();
});

function hidden(container: HTMLElement, name: string): string {
  const input = container.querySelector<HTMLInputElement>(
    `input[type="hidden"][name="${name}"]`,
  );
  return input?.value ?? "";
}

const RULES: RulesFormValues = {
  injuryFrequency: "medium",
  salaryCapEnabled: true,
  salaryCap: 150_000_000,
  staffBudget: 20_000_000,
  luxuryTaxEnabled: false,
  salaryFloorEnabled: false,
  veteranRightsEnabled: false,
  revenueSharingEnabled: false,
  draftLotteryEnabled: true,
  restrictedFreeAgency: false,
};

describe("RulesForm", () => {
  it("disables Save until a rule changes, then sends only the changed rules", () => {
    const { container } = render(
      <RulesForm
        saveId="save_1"
        returnPath="/dashboard/save_1/settings/rules"
        initial={RULES}
        rfaLock={null}
        canEdit
      />,
    );
    const save = screen.getByRole("button", {
      name: "Save rules",
    }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText("Luxury tax"));
    expect(save.disabled).toBe(false);
    const payload = JSON.parse(hidden(container, "changesJson")) as Record<
      string,
      unknown
    >;
    expect(payload).toEqual({ financialRules: { luxuryTaxEnabled: true } });
    expect(payload).not.toHaveProperty("seasonFormat");
    expect(hidden(container, "returnPath")).toBe(
      "/dashboard/save_1/settings/rules",
    );
  });

  it("disables the restricted free agency toggle and shows the lock reason", () => {
    render(
      <RulesForm
        saveId="save_1"
        returnPath="/p"
        initial={RULES}
        rfaLock="Restricted free agency can change after free agency ends."
        canEdit
      />,
    );
    const toggle = screen.getByLabelText(
      /Restricted free agency/,
    ) as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    expect(
      screen.getByText(
        "Restricted free agency can change after free agency ends.",
      ),
    ).toBeTruthy();
  });
});

describe("SeasonFormatForm", () => {
  const initial = { gamesPerTeam: 82, playoffTeams: 8, seriesLength: 7 };

  it("disables controls and shows the reason when locked", () => {
    render(
      <SeasonFormatForm
        saveId="save_1"
        returnPath="/p"
        initial={initial}
        liveTeamCount={30}
        lockReason="Season format can change in the offseason."
        canEdit
      />,
    );
    for (const select of screen.getAllByRole("combobox")) {
      expect((select as HTMLSelectElement).disabled).toBe(true);
    }
    expect(
      screen.getByText("Season format can change in the offseason."),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Save season format/ }),
    ).toBeNull();
  });

  it("only offers playoff team counts the league can fill", () => {
    render(
      <SeasonFormatForm
        saveId="save_1"
        returnPath="/p"
        initial={{ ...initial, playoffTeams: 4 }}
        liveTeamCount={8}
        lockReason={null}
        canEdit
      />,
    );
    const select = screen.getByLabelText("Playoff teams") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual([
      "4",
      "6",
      "8",
    ]);
    const series = screen.getByLabelText("Series length") as HTMLSelectElement;
    expect(Array.from(series.options).map((option) => option.text)).toEqual([
      "Single game",
      "Best of 3",
      "Best of 5",
      "Best of 7",
    ]);
  });

  it("submits the chosen format as changesJson", () => {
    const { container } = render(
      <SeasonFormatForm
        saveId="save_1"
        returnPath="/p"
        initial={initial}
        liveTeamCount={30}
        lockReason={null}
        canEdit
      />,
    );
    fireEvent.change(screen.getByLabelText("Games per team"), {
      target: { value: "60" },
    });
    expect(JSON.parse(hidden(container, "changesJson"))).toEqual({
      seasonFormat: { gamesPerTeam: 60, playoffTeams: 8, seriesLength: 7 },
    });
  });
});

describe("RosterEditorForm", () => {
  it("builds a patch with names, age, potential and every attribute", () => {
    const attributes = Object.fromEntries(
      PLAYER_ATTRIBUTE_KEYS.map((key) => [key, 50]),
    ) as PlayerAttributes;
    const { container } = render(
      <RosterEditorForm
        saveId="save_1"
        returnPath="/dashboard/save_1/settings/tools?team=t1&player=p1"
        player={{
          id: "p1",
          firstName: "Ann",
          lastName: "Lee",
          age: 24,
          potential: 70,
          attributes,
        }}
      />,
    );
    fireEvent.change(screen.getByLabelText("Three Point"), {
      target: { value: "88" },
    });
    fireEvent.change(screen.getByLabelText("Potential"), {
      target: { value: "91" },
    });
    expect(hidden(container, "playerId")).toBe("p1");
    expect(hidden(container, "returnPath")).toBe(
      "/dashboard/save_1/settings/tools?team=t1&player=p1",
    );
    const patch = JSON.parse(hidden(container, "patchJson")) as {
      potential: { overall: number };
      attributes: Record<string, number>;
    };
    expect(Object.keys(patch).sort()).toEqual([
      "age",
      "attributes",
      "firstName",
      "lastName",
      "potential",
    ]);
    expect(patch.potential).toEqual({ overall: 91 });
    expect(patch.attributes.threePoint).toBe(88);
    expect(Object.keys(patch.attributes)).toHaveLength(
      PLAYER_ATTRIBUTE_KEYS.length,
    );
  });
});
