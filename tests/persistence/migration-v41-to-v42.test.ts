import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import {
  deserializeGameState,
  serializeGameState,
} from "@/persistence/mappers/game-state-mapper";
import { validateGameState } from "@/persistence/validate-game-state";
import { createSeededRng } from "@/domain/rng";
import { GAME_STATE_SCHEMA_VERSION } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { resolveOnboardingRoute } from "@/application/onboarding-routing";
import {
  getActiveOwnedFranchise,
  withOwnedFranchise,
} from "@/state/owner-context";

describe("v41 → v42 migration", () => {
  it("marks completed city selection as franchise identity confirmed", () => {
    let modern = createTestGameState({ saveId: "mig_v42_done" });
    modern = bootstrapWorld(modern, createSeededRng(modern.meta.rngState)).state;
    modern = withOwnedFranchise(modern, modern.user.activeOwnerTeamId, (f) => ({
      ...f,
      citySelectionConfirmed: true,
      franchiseIdentityConfirmed: true,
    }));

    const active = modern.user.activeOwnerTeamId;
    const franchise = modern.user.ownedFranchises[active]!;
    const parsed = {
      ...JSON.parse(serializeGameState(modern)),
      meta: {
        ...modern.meta,
        schemaVersion: 41,
      },
      user: {
        controlledTeamId: active,
        mode: modern.user.mode,
        citySelectionConfirmed: true,
        ownerStartSeasonYear: franchise.ownerStartSeasonYear,
        ownerPhilosophy: "balanced",
        ownerPatience: franchise.ownerPatience,
        ownershipConfidence: franchise.ownershipConfidence,
        objectives: franchise.objectives,
        notifications: franchise.notifications,
        eventLog: franchise.eventLog,
        appliedGameplayConsequenceKeys: franchise.appliedGameplayConsequenceKeys,
        explicitDecisions: franchise.explicitDecisions,
        phaseSkips: franchise.phaseSkips,
        aiAssistState: franchise.aiAssistState,
        pendingOwnerDecisions: modern.user.pendingOwnerDecisions,
        ownerDecisionHistory: modern.user.ownerDecisionHistory,
        narrative: franchise.narrative,
      },
      world: {
        ...modern.world,
        teams: Object.fromEntries(
          Object.entries(modern.world.teams).map(([teamId, team]) => {
            const { branding: _removed, ...rest } = team;
            return [teamId, rest];
          }),
        ),
      },
    } as {
      meta: { schemaVersion: number };
      user: Record<string, unknown>;
      world: { teams: Record<string, Record<string, unknown>> };
    };

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(loaded.meta.schemaVersion).toBe(GAME_STATE_SCHEMA_VERSION);
    expect(getActiveOwnedFranchise(loaded).citySelectionConfirmed).toBe(true);
    expect(getActiveOwnedFranchise(loaded).franchiseIdentityConfirmed).toBe(true);
    for (const team of Object.values(loaded.world.teams)) {
      expect(team.branding.logoId).toBeTruthy();
      expect(team.branding.primaryColor).toMatch(/^#[0-9A-F]{6}$/);
    }
    expect(() => validateGameState(loaded)).not.toThrow();
    expect(
      resolveOnboardingRoute("mig_v42_done", {
        citySelectionConfirmed: getActiveOwnedFranchise(loaded).citySelectionConfirmed,
        franchiseIdentityConfirmed: getActiveOwnedFranchise(loaded).franchiseIdentityConfirmed,
      }).kind,
    ).toBe("dashboard");
  });

  it("keeps in-progress city selection on city step", () => {
    let modern = createTestGameState({ saveId: "mig_v42_progress" });
    modern = bootstrapWorld(modern, createSeededRng(modern.meta.rngState)).state;
    modern = withOwnedFranchise(modern, modern.user.activeOwnerTeamId, (f) => ({
      ...f,
      citySelectionConfirmed: false,
      franchiseIdentityConfirmed: false,
    }));

    const active = modern.user.activeOwnerTeamId;
    const franchise = modern.user.ownedFranchises[active]!;
    const parsed = {
      ...JSON.parse(serializeGameState(modern)),
      meta: {
        ...modern.meta,
        schemaVersion: 41,
      },
      user: {
        controlledTeamId: active,
        mode: modern.user.mode,
        citySelectionConfirmed: false,
        ownerStartSeasonYear: franchise.ownerStartSeasonYear,
        ownerPhilosophy: "balanced",
        ownerPatience: franchise.ownerPatience,
        ownershipConfidence: franchise.ownershipConfidence,
        objectives: franchise.objectives,
        notifications: franchise.notifications,
        eventLog: franchise.eventLog,
        appliedGameplayConsequenceKeys: franchise.appliedGameplayConsequenceKeys,
        explicitDecisions: franchise.explicitDecisions,
        phaseSkips: franchise.phaseSkips,
        aiAssistState: franchise.aiAssistState,
        pendingOwnerDecisions: modern.user.pendingOwnerDecisions,
        ownerDecisionHistory: modern.user.ownerDecisionHistory,
        narrative: franchise.narrative,
      },
      world: {
        ...modern.world,
        teams: Object.fromEntries(
          Object.entries(modern.world.teams).map(([teamId, team]) => {
            const { branding: _removed, ...rest } = team;
            return [teamId, rest];
          }),
        ),
      },
    } as {
      meta: { schemaVersion: number };
      user: Record<string, unknown>;
      world: { teams: Record<string, Record<string, unknown>> };
    };

    const loaded = deserializeGameState(JSON.stringify(parsed));
    expect(getActiveOwnedFranchise(loaded).citySelectionConfirmed).toBe(false);
    expect(getActiveOwnedFranchise(loaded).franchiseIdentityConfirmed).toBe(false);
    expect(Object.values(loaded.world.teams)[0]!.branding.logoId).toBeTruthy();
    expect(
      resolveOnboardingRoute("mig_v42_progress", {
        citySelectionConfirmed: getActiveOwnedFranchise(loaded).citySelectionConfirmed,
        franchiseIdentityConfirmed: getActiveOwnedFranchise(loaded).franchiseIdentityConfirmed,
      }),
    ).toEqual({ kind: "city", path: "/new/mig_v42_progress/team" });
  });
});
