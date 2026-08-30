import { describe, expect, it } from "vitest";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createSeededRng } from "@/domain/rng";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { hydrateStaffFromPersisted } from "@/systems/staff-ratings";
import { asStaffId } from "@/domain/ids";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";

describe("staff persistence / v50", () => {
  it("new leagues seed staff with overall attributes and staffMarket", () => {
    let state = createInitialGameState({
      saveId: "staff_persist_new",
      rngSeed: 42,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    expect(state.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(state.world.staffMarket).toEqual({ offers: {} });
    const staffIds = Object.keys(state.world.staff);
    expect(staffIds.length).toBeGreaterThan(0);

    const sample = state.world.staff[staffIds[0]!]!;
    expect(sample.overall).toBeGreaterThanOrEqual(1);
    expect(sample.potential).toBeGreaterThanOrEqual(sample.overall - 5);
    expect(sample.attributes).toBeDefined();
    expect(sample.preferences.desiredSalary).toBeGreaterThan(0);

    const hasMedical = Object.values(state.world.staff).some(
      (s) => s.role === "medical" && s.teamId !== null,
    );
    expect(hasMedical).toBe(true);

    const hasPr = Object.values(state.world.staff).some(
      (s) => s.role === "public_relations",
    );
    expect(hasPr).toBe(true);
  });

  it("hydrateStaffFromPersisted migrates legacy quality/marketing", () => {
    const staff = hydrateStaffFromPersisted(
      {
        id: "staff_legacy_1",
        teamId: null,
        firstName: "Legacy",
        lastName: "Marketer",
        role: "marketing",
        quality: 62,
        experience: 8,
        strengths: ["scouting"],
        weaknesses: ["ego"],
      },
      "staff_legacy_1",
    );
    expect(staff.id).toBe(asStaffId("staff_legacy_1"));
    expect(staff.role).toBe("public_relations");
    expect(staff.overall).toBeGreaterThanOrEqual(1);
    expect(staff.potential).toBeGreaterThanOrEqual(1);
    expect(staff.preferences.minimumSalary).toBeGreaterThan(0);
  });

  it("deserialize migrates schema 49 staff shape to 50", () => {
    let state = createInitialGameState({
      saveId: "staff_migrate_49",
      rngSeed: 7,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const legacyStaff: Record<string, unknown> = {};
    for (const [id, member] of Object.entries(state.world.staff)) {
      legacyStaff[id] = {
        id: member.id,
        teamId: member.teamId,
        firstName: member.firstName,
        lastName: member.lastName,
        role:
          member.role === "public_relations" ? "marketing" : member.role,
        quality: member.overall,
        experience: member.experience,
        strengths: [],
        weaknesses: [],
      };
    }

    const v49Payload = {
      ...JSON.parse(serializeGameState(state)),
      meta: {
        ...state.meta,
        schemaVersion: 49,
      },
      world: {
        ...JSON.parse(serializeGameState(state)).world,
        staff: legacyStaff,
      },
    };
    delete (v49Payload.world as Record<string, unknown>).staffMarket;

    const migrated = deserializeGameState(JSON.stringify(v49Payload));
    expect(migrated.meta.schemaVersion).toBe(51);
    expect(migrated.world.staffMarket).toEqual({ offers: {} });

    for (const member of Object.values(migrated.world.staff)) {
      expect(member.role).not.toBe("marketing" as never);
      expect(member.overall).toBeGreaterThanOrEqual(1);
      expect(member.attributes).toBeDefined();
    }
  });
});
