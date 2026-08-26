import { describe, expect, it } from "vitest";
import { createTestGameState } from "../factories/game-state";
import { completeRelocationTransition } from "@/systems/relocation";
import { getTeamIdentityFingerprint } from "@/domain/team-identity";
import type { GameState } from "@/state/game-state";
import { RELOCATION_MIN_SEASONS_IN_CITY } from "@/systems/relocation-config";
import { brandingFromPalette } from "@/domain/entities/team-branding";

function withTransition(state: GameState): GameState {
  const teamId = state.user.controlledTeamId;
  const year = state.competition.season.year;
  const process = state.business.relocationByTeamId[teamId]!;
  return {
    ...state,
    business: {
      ...state.business,
      relocationByTeamId: {
        ...state.business.relocationByTeamId,
        [teamId]: {
          ...process,
          stage: "transition",
          target: {
            city: "Harbor",
            name: "Waves",
            abbreviation: "HAR",
            marketSize: 72,
          },
          fee: 25_000_000,
          cityStartSeasonYear: year - RELOCATION_MIN_SEASONS_IN_CITY - 2,
        },
      },
    },
  };
}

describe("relocation preserves franchise identity", () => {
  it("keeps nickname and branding when city changes", () => {
    let state = createTestGameState({ saveId: "reloc_brand" });
    const teamId = state.user.controlledTeamId;
    const customBranding = brandingFromPalette("royal_purple", "crown");
    state = {
      ...state,
      world: {
        ...state.world,
        teams: {
          ...state.world.teams,
          [teamId]: {
            ...state.world.teams[teamId]!,
            name: "Huskies",
            branding: customBranding,
          },
        },
      },
    };
    state = withTransition(state);
    const before = getTeamIdentityFingerprint(state.world.teams[teamId]!);
    const result = completeRelocationTransition(state, teamId);
    const afterTeam = result.state.world.teams[teamId]!;
    expect(afterTeam.city).toBe("Harbor");
    expect(afterTeam.name).toBe("Huskies");
    expect(afterTeam.branding).toEqual(customBranding);
    expect(afterTeam.abbreviation).toBe("HAR");
    expect(getTeamIdentityFingerprint(afterTeam)).toEqual({
      ...before,
      city: "Harbor",
      abbreviation: "HAR",
    });
  });
});
