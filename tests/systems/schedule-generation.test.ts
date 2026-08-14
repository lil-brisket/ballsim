import { describe, expect, it } from "vitest";
import { asTeamId, type TeamId } from "@/domain/ids";
import {
  defaultSeasonLength,
  expectedRoundCount,
  type SeasonScheduleAssignment,
  type SeasonScheduleConfig,
} from "@/systems/schedule-generation-config";
import { generateSeasonSchedule } from "@/systems/schedule-generation";
import { validateSeasonSchedule } from "@/systems/schedule-validation";

function teamIds(...ids: string[]): TeamId[] {
  return ids.map(asTeamId);
}

function config(
  ids: TeamId[],
  seasonLength: number,
): SeasonScheduleConfig {
  return { teamIds: ids, seasonLength };
}

function assertScheduleInvariants(
  cfg: SeasonScheduleConfig,
  assignments: SeasonScheduleAssignment[],
): void {
  expect(() => validateSeasonSchedule(cfg, assignments)).not.toThrow();

  const n = cfg.teamIds.length;
  const g = cfg.seasonLength;
  expect(assignments.length).toBe((n * g) / 2);

  const roundCount = expectedRoundCount(n, g);
  const rounds = new Set(assignments.map((a) => a.round));
  for (let r = 1; r <= roundCount; r += 1) {
    expect(rounds.has(r)).toBe(true);
  }

  const gamesByTeam = new Map<string, number>();
  const homeByTeam = new Map<string, number>();
  const awayByTeam = new Map<string, number>();
  for (const id of cfg.teamIds) {
    gamesByTeam.set(id, 0);
    homeByTeam.set(id, 0);
    awayByTeam.set(id, 0);
  }

  const teamsByRound = new Map<number, Set<string>>();
  const matchupCounts = new Map<string, number>();

  for (const game of assignments) {
    expect(game.homeTeamId).not.toBe(game.awayTeamId);
    expect(cfg.teamIds).toContain(game.homeTeamId);
    expect(cfg.teamIds).toContain(game.awayTeamId);

    let inRound = teamsByRound.get(game.round);
    if (!inRound) {
      inRound = new Set();
      teamsByRound.set(game.round, inRound);
    }
    expect(inRound.has(game.homeTeamId)).toBe(false);
    expect(inRound.has(game.awayTeamId)).toBe(false);
    inRound.add(game.homeTeamId);
    inRound.add(game.awayTeamId);

    gamesByTeam.set(
      game.homeTeamId,
      gamesByTeam.get(game.homeTeamId)! + 1,
    );
    gamesByTeam.set(
      game.awayTeamId,
      gamesByTeam.get(game.awayTeamId)! + 1,
    );
    homeByTeam.set(game.homeTeamId, homeByTeam.get(game.homeTeamId)! + 1);
    awayByTeam.set(game.awayTeamId, awayByTeam.get(game.awayTeamId)! + 1);

    const key =
      game.homeTeamId < game.awayTeamId
        ? `${game.homeTeamId}|${game.awayTeamId}`
        : `${game.awayTeamId}|${game.homeTeamId}`;
    matchupCounts.set(key, (matchupCounts.get(key) ?? 0) + 1);
  }

  for (const id of cfg.teamIds) {
    expect(gamesByTeam.get(id)).toBe(g);
    const homes = homeByTeam.get(id)!;
    const aways = awayByTeam.get(id)!;
    expect(Math.abs(homes - aways)).toBeLessThanOrEqual(1);
  }

  let min = Number.POSITIVE_INFINITY;
  let max = 0;
  for (let i = 0; i < cfg.teamIds.length; i += 1) {
    for (let j = i + 1; j < cfg.teamIds.length; j += 1) {
      const a = cfg.teamIds[i]!;
      const b = cfg.teamIds[j]!;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const count = matchupCounts.get(key) ?? 0;
      min = Math.min(min, count);
      max = Math.max(max, count);
    }
  }
  expect(max - min).toBeLessThanOrEqual(1);
}

describe("generateSeasonSchedule", () => {
  it("schedules a small even league", () => {
    const cfg = config(teamIds("t1", "t2", "t3", "t4"), 6);
    const schedule = generateSeasonSchedule(cfg);
    assertScheduleInvariants(cfg, schedule);
    expect(expectedRoundCount(4, 6)).toBe(6);
  });

  it("schedules a small odd league", () => {
    const cfg = config(teamIds("a", "b", "c", "d", "e"), 4);
    const schedule = generateSeasonSchedule(cfg);
    assertScheduleInvariants(cfg, schedule);
    expect(expectedRoundCount(5, 4)).toBe(5);
  });

  it("supports the minimum valid league size (2 teams)", () => {
    const cfg = config(teamIds("home", "away"), 4);
    const schedule = generateSeasonSchedule(cfg);
    assertScheduleInvariants(cfg, schedule);
    expect(schedule.length).toBe(4);
  });

  it("schedules a larger configurable league", () => {
    const ids = teamIds(
      ...Array.from({ length: 10 }, (_, i) => `team_${String(i).padStart(2, "0")}`),
    );
    const cfg = config(ids, defaultSeasonLength(10));
    const schedule = generateSeasonSchedule(cfg);
    assertScheduleInvariants(cfg, schedule);
    expect(expectedRoundCount(10, 18)).toBe(18);
  });

  it("supports a short season for even and odd leagues", () => {
    const evenCfg = config(teamIds("a", "b", "c", "d"), 1);
    assertScheduleInvariants(evenCfg, generateSeasonSchedule(evenCfg));

    const oddCfg = config(teamIds("a", "b", "c"), 2);
    assertScheduleInvariants(oddCfg, generateSeasonSchedule(oddCfg));
  });

  it("supports a longer season requiring repeat matchups", () => {
    const cfg = config(teamIds("a", "b", "c", "d"), 9);
    const schedule = generateSeasonSchedule(cfg);
    assertScheduleInvariants(cfg, schedule);
    // n-1 = 3 unique opponents; 9 games => each pair appears 3 times
    expect(schedule.length).toBe(18);
  });

  it("balances home/away for even season length", () => {
    const cfg = config(teamIds("a", "b", "c", "d"), 6);
    const schedule = generateSeasonSchedule(cfg);
    for (const id of cfg.teamIds) {
      const homes = schedule.filter((g) => g.homeTeamId === id).length;
      const aways = schedule.filter((g) => g.awayTeamId === id).length;
      expect(homes).toBe(3);
      expect(aways).toBe(3);
    }
  });

  it("balances home/away for odd season length (even team count)", () => {
    const cfg = config(teamIds("a", "b", "c", "d"), 5);
    const schedule = generateSeasonSchedule(cfg);
    for (const id of cfg.teamIds) {
      const homes = schedule.filter((g) => g.homeTeamId === id).length;
      const aways = schedule.filter((g) => g.awayTeamId === id).length;
      expect(Math.abs(homes - aways)).toBeLessThanOrEqual(1);
      expect(homes + aways).toBe(5);
    }
  });

  it("never schedules a team twice in one round", () => {
    const cfg = config(teamIds("a", "b", "c", "d", "e", "f"), 5);
    const schedule = generateSeasonSchedule(cfg);
    const byRound = new Map<number, string[]>();
    for (const game of schedule) {
      const list = byRound.get(game.round) ?? [];
      list.push(game.homeTeamId, game.awayTeamId);
      byRound.set(game.round, list);
    }
    for (const [, teams] of byRound) {
      expect(new Set(teams).size).toBe(teams.length);
    }
  });

  it("never creates self-matchups", () => {
    const cfg = config(teamIds("a", "b", "c", "d"), 6);
    for (const game of generateSeasonSchedule(cfg)) {
      expect(game.homeTeamId).not.toBe(game.awayTeamId);
    }
  });

  it("keeps unordered matchup counts within one", () => {
    const cfg = config(teamIds("a", "b", "c", "d", "e"), 8);
    assertScheduleInvariants(cfg, generateSeasonSchedule(cfg));
  });

  it("prefers alternating home/away on repeated matchups", () => {
    const cfg = config(teamIds("a", "b", "c", "d"), 6);
    const schedule = generateSeasonSchedule(cfg);
    const byPair = new Map<string, SeasonScheduleAssignment[]>();
    for (const game of schedule) {
      const key =
        game.homeTeamId < game.awayTeamId
          ? `${game.homeTeamId}|${game.awayTeamId}`
          : `${game.awayTeamId}|${game.homeTeamId}`;
      const list = byPair.get(key) ?? [];
      list.push(game);
      byPair.set(key, list);
    }
    for (const [, games] of byPair) {
      if (games.length < 2) {
        continue;
      }
      // Sorted by round; consecutive meetings should usually flip venue
      const ordered = [...games].sort((x, y) => x.round - y.round);
      let flips = 0;
      for (let i = 1; i < ordered.length; i += 1) {
        if (ordered[i]!.homeTeamId !== ordered[i - 1]!.homeTeamId) {
          flips += 1;
        }
      }
      expect(flips).toBeGreaterThanOrEqual(ordered.length - 2);
    }
  });

  it("throws on impossible configurations", () => {
    expect(() =>
      generateSeasonSchedule(config(teamIds("only"), 2)),
    ).toThrow(/at least 2 teams/);

    expect(() =>
      generateSeasonSchedule(config(teamIds("a", "a"), 2)),
    ).toThrow(/unique/);

    expect(() =>
      generateSeasonSchedule(config(teamIds("a", "b"), 0)),
    ).toThrow(/seasonLength/);

    expect(() =>
      generateSeasonSchedule(config(teamIds("a", "b", "c"), 3)),
    ).toThrow(/multiple of 2/);
  });

  it("is deterministic when no RNG is supplied", () => {
    const cfg = config(teamIds("z", "a", "m", "b"), 7);
    const first = generateSeasonSchedule(cfg);
    const second = generateSeasonSchedule(cfg);
    expect(first).toEqual(second);
    // Input order must not matter
    const shuffled = generateSeasonSchedule(
      config(teamIds("b", "z", "a", "m"), 7),
    );
    expect(shuffled).toEqual(first);
  });

  it("uses defaultSeasonLength equal to double round-robin games per team", () => {
    expect(defaultSeasonLength(4)).toBe(6);
    expect(defaultSeasonLength(5)).toBe(8);
    expect(defaultSeasonLength(10)).toBe(18);
  });
});
