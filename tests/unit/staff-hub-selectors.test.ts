import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";
import { toStaffHubView } from "@/state/staff-hub-selectors";
import { toStaffView } from "@/state/franchise-selectors";

describe("staff-hub-selectors", () => {
  it("builds staff directory grouped by role without inventing roles", () => {
    let state = createTestGameState({ saveId: "staff_hub_test" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const hub = toStaffHubView(state);
    const staff = toStaffView(state);

    expect(hub.staffCount).toBe(staff.roster.length);
    const directoryCount = hub.directory.reduce(
      (sum, g) => sum + g.members.length,
      0,
    );
    expect(directoryCount).toBe(staff.roster.length);
    expect(hub.available.length).toBe(staff.available.length);

    for (const group of hub.directory) {
      expect(group.members.length).toBeGreaterThan(0);
      expect(group.roleLabel.length).toBeGreaterThan(0);
    }
  });

  it("reports vacancies for missing starter roles", () => {
    let state = createTestGameState({ saveId: "staff_hub_vac" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const hub = toStaffHubView(state);
    expect(hub.vacancyCount).toBe(hub.vacantRoles.length);
    expect(hub.vacancyCount).toBeGreaterThanOrEqual(0);
  });
});
