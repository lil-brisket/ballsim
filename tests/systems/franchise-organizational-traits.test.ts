import { describe, expect, it } from "vitest";
import type { AiProfile } from "@/domain/entities/franchise-ops";
import {
  deriveOrganizationalTraits,
  failureModePreferenceBias,
} from "@/systems/franchise-organizational-traits";

function identity(profile: AiProfile, spending = 50, patience = 50, risk = 50) {
  return {
    aiProfile: profile,
    spendingTolerance: spending,
    patience,
    riskTolerance: risk,
    marketSize: 50,
  };
}

describe("deriveOrganizationalTraits", () => {
  it("maps each aiProfile to distinct trait fingerprints", () => {
    const profiles: AiProfile[] = [
      "win_now",
      "aggressive",
      "conservative",
      "development",
      "rebuild",
      "market_growth",
    ];
    const results = profiles.map((profile) => ({
      profile,
      ...deriveOrganizationalTraits(identity(profile)),
    }));

    const winNow = results.find((r) => r.profile === "win_now")!;
    const conservative = results.find((r) => r.profile === "conservative")!;
    const development = results.find((r) => r.profile === "development")!;
    const rebuild = results.find((r) => r.profile === "rebuild")!;
    const market = results.find((r) => r.profile === "market_growth")!;

    expect(winNow.traits.competitiveness).toBeGreaterThan(
      conservative.traits.competitiveness,
    );
    expect(conservative.traits.financialConservatism).toBeGreaterThan(
      winNow.traits.financialConservatism,
    );
    expect(development.traits.developmentPreference).toBeGreaterThan(
      winNow.traits.developmentPreference,
    );
    expect(rebuild.traits.assetAccumulation).toBeGreaterThan(
      market.traits.assetAccumulation,
    );
    expect(market.traits.marketGrowth).toBeGreaterThan(
      conservative.traits.marketGrowth,
    );
  });

  it("attaches strength and failure mode labels", () => {
    const prestige = deriveOrganizationalTraits(identity("win_now"));
    expect(prestige.strength).toMatch(/winning/i);
    expect(prestige.failureMode).toMatch(/overspend/i);

    const conservative = deriveOrganizationalTraits(identity("conservative"));
    expect(conservative.failureMode).toMatch(/opportunit/i);
  });

  it("blends spending axis into conservatism and competitiveness", () => {
    const low = deriveOrganizationalTraits(identity("aggressive", 20, 50, 50));
    const high = deriveOrganizationalTraits(identity("aggressive", 90, 50, 50));
    expect(high.traits.competitiveness).toBeGreaterThan(
      low.traits.competitiveness,
    );
    expect(low.traits.financialConservatism).toBeGreaterThan(
      high.traits.financialConservatism,
    );
  });

  it("provides failure-mode floors for prestige and development orgs", () => {
    const prestige = deriveOrganizationalTraits(identity("win_now"));
    const prestigeBias = failureModePreferenceBias(
      "win_now",
      prestige.traits,
    );
    expect(prestigeBias.spendWillingnessFloor).toBeGreaterThan(0.3);

    const development = deriveOrganizationalTraits(identity("development"));
    const developmentBias = failureModePreferenceBias(
      "development",
      development.traits,
    );
    expect(developmentBias.youthValueFloor).toBeGreaterThan(0.4);
  });
});
