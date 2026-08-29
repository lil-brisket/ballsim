import { describe, expect, it } from "vitest";
import { resolveOnboardingRoute } from "@/application/onboarding-routing";

describe("resolveOnboardingRoute fantasy draft", () => {
  it("routes to fantasy setup after franchises when fantasy mode incomplete", () => {
    const route = resolveOnboardingRoute("save_1", {
      citySelectionConfirmed: true,
      franchiseIdentityConfirmed: true,
      fantasyDraftMode: true,
      fantasyDraftStatus: "setup",
    });
    expect(route.kind).toBe("fantasy_setup");
    expect(route.path).toBe("/new/save_1/fantasy-draft/setup");
  });

  it("routes to live fantasy draft when active", () => {
    const route = resolveOnboardingRoute("save_1", {
      citySelectionConfirmed: true,
      franchiseIdentityConfirmed: true,
      fantasyDraftMode: true,
      fantasyDraftStatus: "active",
    });
    expect(route.kind).toBe("fantasy_draft");
    expect(route.path).toBe("/fantasy-draft/save_1");
  });

  it("routes to dashboard when fantasy draft is complete", () => {
    const route = resolveOnboardingRoute("save_1", {
      citySelectionConfirmed: true,
      franchiseIdentityConfirmed: true,
      fantasyDraftMode: true,
      fantasyDraftStatus: "complete",
    });
    expect(route.kind).toBe("dashboard");
  });

  it("does not gate standard leagues", () => {
    const route = resolveOnboardingRoute("save_1", {
      citySelectionConfirmed: true,
      franchiseIdentityConfirmed: true,
      fantasyDraftMode: false,
    });
    expect(route.kind).toBe("dashboard");
  });
});
