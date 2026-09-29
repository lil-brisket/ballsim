import { describe, expect, it } from "vitest";
import { RATING_MAX, RATING_MIN } from "@/domain/entities/player";
import { asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { clonePlayerWithAttributeClamps } from "@/simulation/lab/scenarios/clamp-attributes";
import { generateValidationRosters } from "@/simulation/validation/run-validation";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";

describe("Lab rating clamp", () => {
  it("keeps clamped attributes inside RATING_MIN/MAX", () => {
    const { homePlayers } = generateValidationRosters(createSeededRng(3), 8);
    const player = homePlayers[0]!;
    const clamped = clonePlayerWithAttributeClamps(
      player,
      ["finishing", "threePoint"],
      0,
      200,
      "clamp_test",
      asTeamId("team_validation_home"),
    );
    expect(clamped.attributes.finishing).toBeGreaterThanOrEqual(RATING_MIN);
    expect(clamped.attributes.finishing).toBeLessThanOrEqual(RATING_MAX);
    expect(homePlayers).toHaveLength(TRADE_ROSTER_RULES.minRosterSize);
  });
});
