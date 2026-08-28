import { describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import {
  TEAM_LOGO_CATALOG,
  TEAM_LOGO_CATEGORIES,
  TEAM_LOGO_IDS,
  getLogosByCategory,
  isTeamLogoId,
} from "@/data/team-branding/logo-catalog";
import { validateTeamBranding } from "@/domain/entities/team-branding";
import { randomizeLogoId } from "@/systems/owner-franchise-branding";
import { createSeededRng } from "@/domain/rng";
import { LOGO_COMPONENTS } from "@/components/team/logos/logo-registry";
import { TeamLogoMark } from "@/components/team/logos/TeamLogoMark";

const LEGACY_LOGO_IDS = [
  "wolf",
  "bear",
  "eagle",
  "lion",
  "lightning",
  "flame",
  "crown",
  "shield",
  "star",
  "monogram",
] as const;

const EXPECTED_CATEGORY_COUNTS: Record<string, number> = {
  mascots: 14,
  sports: 9,
  power: 10,
  classic: 9,
  regional: 10,
};

describe("team logo catalog", () => {
  it("has unique logo IDs", () => {
    const ids = TEAM_LOGO_CATALOG.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("matches the intended catalog shape", () => {
    expect(TEAM_LOGO_CATALOG.length).toBe(52);
    for (const category of TEAM_LOGO_CATEGORIES) {
      const logos = getLogosByCategory(category.id);
      expect(logos.length).toBe(EXPECTED_CATEGORY_COUNTS[category.id]);
    }
  });

  it("keeps all legacy logo IDs valid", () => {
    for (const id of LEGACY_LOGO_IDS) {
      expect(isTeamLogoId(id)).toBe(true);
      const result = validateTeamBranding({
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: id,
      });
      expect(result.ok).toBe(true);
    }
  });

  it("randomizeLogoId returns a different valid catalog ID", () => {
    const rng = createSeededRng(42);
    const next = randomizeLogoId("wolf", rng);
    expect(isTeamLogoId(next)).toBe(true);
    expect(next).not.toBe("wolf");
  });
});

describe("logo registry", () => {
  it("registers a component for every catalog logo ID", () => {
    for (const id of TEAM_LOGO_IDS) {
      expect(LOGO_COMPONENTS[id]).toBeTypeOf("function");
    }
  });

  it("renders every registered logo without throwing", () => {
    for (const id of TEAM_LOGO_IDS) {
      expect(() => {
        render(
          <TeamLogoMark
            logoId={id}
            primaryColor="#0B1F3A"
            secondaryColor="#C4CED4"
            accentColor="#F5B800"
            title={id}
          />,
        );
      }).not.toThrow();
      cleanup();
    }
  });
});
