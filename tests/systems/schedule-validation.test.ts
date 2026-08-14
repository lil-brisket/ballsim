import { describe, expect, it } from "vitest";
import { asTeamId, type TeamId } from "@/domain/ids";
import {
  type SeasonScheduleAssignment,
  type SeasonScheduleConfig,
} from "@/systems/schedule-generation-config";
import { generateSeasonSchedule } from "@/systems/schedule-generation";
import { validateSeasonSchedule } from "@/systems/schedule-validation";

function teamIds(...ids: string[]): TeamId[] {
  return ids.map(asTeamId);
}

function validConfig(): SeasonScheduleConfig {
  return { teamIds: teamIds("a", "b", "c", "d"), seasonLength: 3 };
}

describe("validateSeasonSchedule", () => {
  it("accepts a schedule produced by the generator", () => {
    const config = validConfig();
    const assignments = generateSeasonSchedule(config);
    expect(() => validateSeasonSchedule(config, assignments)).not.toThrow();
  });

  it("rejects self-matchups", () => {
    const config = validConfig();
    const bad: SeasonScheduleAssignment[] = [
      { round: 1, homeTeamId: asTeamId("a"), awayTeamId: asTeamId("a") },
      { round: 1, homeTeamId: asTeamId("b"), awayTeamId: asTeamId("c") },
      { round: 2, homeTeamId: asTeamId("a"), awayTeamId: asTeamId("b") },
      { round: 2, homeTeamId: asTeamId("c"), awayTeamId: asTeamId("d") },
      { round: 3, homeTeamId: asTeamId("a"), awayTeamId: asTeamId("c") },
      { round: 3, homeTeamId: asTeamId("b"), awayTeamId: asTeamId("d") },
    ];
    expect(() => validateSeasonSchedule(config, bad)).toThrow(/distinct/);
  });

  it("rejects unknown team ids", () => {
    const config = validConfig();
    const bad: SeasonScheduleAssignment[] = [
      { round: 1, homeTeamId: asTeamId("a"), awayTeamId: asTeamId("ghost") },
      { round: 1, homeTeamId: asTeamId("b"), awayTeamId: asTeamId("c") },
      { round: 2, homeTeamId: asTeamId("a"), awayTeamId: asTeamId("b") },
      { round: 2, homeTeamId: asTeamId("c"), awayTeamId: asTeamId("d") },
      { round: 3, homeTeamId: asTeamId("a"), awayTeamId: asTeamId("c") },
      { round: 3, homeTeamId: asTeamId("b"), awayTeamId: asTeamId("d") },
    ];
    expect(() => validateSeasonSchedule(config, bad)).toThrow(/not in the config/);
  });

  it("rejects a team playing twice in the same round", () => {
    const config = validConfig();
    const bad: SeasonScheduleAssignment[] = [
      { round: 1, homeTeamId: asTeamId("a"), awayTeamId: asTeamId("b") },
      { round: 1, homeTeamId: asTeamId("a"), awayTeamId: asTeamId("c") },
      { round: 2, homeTeamId: asTeamId("a"), awayTeamId: asTeamId("d") },
      { round: 2, homeTeamId: asTeamId("b"), awayTeamId: asTeamId("c") },
      { round: 3, homeTeamId: asTeamId("b"), awayTeamId: asTeamId("d") },
      { round: 3, homeTeamId: asTeamId("c"), awayTeamId: asTeamId("a") },
    ];
    expect(() => validateSeasonSchedule(config, bad)).toThrow(/more than once/);
  });

  it("rejects wrong total game count", () => {
    const config = validConfig();
    expect(() => validateSeasonSchedule(config, [])).toThrow(/contain 6 games/);
  });

  it("rejects invalid round numbers and missing rounds", () => {
    const config = validConfig();
    const assignments = generateSeasonSchedule(config).map((game, index) =>
      index === 0 ? { ...game, round: 0 } : game,
    );
    expect(() => validateSeasonSchedule(config, assignments)).toThrow(
      /between 1 and/,
    );
  });

  it("rejects home/away imbalance beyond one", () => {
    const config: SeasonScheduleConfig = {
      teamIds: teamIds("a", "b"),
      seasonLength: 2,
    };
    // Both games with a at home → a has 2 home 0 away
    const bad: SeasonScheduleAssignment[] = [
      { round: 1, homeTeamId: asTeamId("a"), awayTeamId: asTeamId("b") },
      { round: 2, homeTeamId: asTeamId("a"), awayTeamId: asTeamId("b") },
    ];
    expect(() => validateSeasonSchedule(config, bad)).toThrow(/home\/away/);
  });

  it("rejects uneven matchup distribution", () => {
    const config: SeasonScheduleConfig = {
      teamIds: teamIds("a", "b", "c", "d"),
      seasonLength: 3,
    };
    // Valid rounds/counts but a-b appears 3 times and others never
    const bad: SeasonScheduleAssignment[] = [
      { round: 1, homeTeamId: asTeamId("a"), awayTeamId: asTeamId("b") },
      { round: 1, homeTeamId: asTeamId("c"), awayTeamId: asTeamId("d") },
      { round: 2, homeTeamId: asTeamId("b"), awayTeamId: asTeamId("a") },
      { round: 2, homeTeamId: asTeamId("d"), awayTeamId: asTeamId("c") },
      { round: 3, homeTeamId: asTeamId("a"), awayTeamId: asTeamId("b") },
      { round: 3, homeTeamId: asTeamId("c"), awayTeamId: asTeamId("d") },
    ];
    expect(() => validateSeasonSchedule(config, bad)).toThrow(/matchup counts/);
  });
});
