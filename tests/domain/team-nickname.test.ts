import { describe, expect, it } from "vitest";
import {
  nextNicknameFromPool,
  normalizeTeamNickname,
  TEAM_NICKNAME_MAX_LENGTH,
  validateTeamNickname,
} from "@/domain/team-nickname";

describe("normalizeTeamNickname", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeTeamNickname("  Atlanta   Knights  ")).toBe("Atlanta Knights");
  });
});

describe("validateTeamNickname", () => {
  it("accepts a generated nickname", () => {
    expect(validateTeamNickname("Knights")).toEqual({
      ok: true,
      value: "Knights",
    });
  });

  it("rejects empty and whitespace-only names", () => {
    expect(validateTeamNickname("")).toEqual({
      ok: false,
      error: "Team name cannot be empty.",
    });
    expect(validateTeamNickname("   ")).toEqual({
      ok: false,
      error: "Team name cannot be empty.",
    });
  });

  it("enforces maximum length after trim", () => {
    const tooLong = "A".repeat(TEAM_NICKNAME_MAX_LENGTH + 1);
    const result = validateTeamNickname(tooLong);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/24 characters/);
    }
  });

  it("rejects invalid characters", () => {
    const result = validateTeamNickname("Knights!!");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/letters, numbers/);
    }
  });

  it("allows hyphens and apostrophes", () => {
    expect(validateTeamNickname("O'Hares")).toEqual({
      ok: true,
      value: "O'Hares",
    });
    expect(validateTeamNickname("Blue-Jays")).toEqual({
      ok: true,
      value: "Blue-Jays",
    });
  });

  it("allows the same nickname in a different city", () => {
    const result = validateTeamNickname("Knights", {
      city: "Chicago",
      existingTeams: [{ id: "team_atl", city: "Atlanta", name: "Knights" }],
    });
    expect(result).toEqual({ ok: true, value: "Knights" });
  });

  it("rejects duplicate city plus nickname", () => {
    const result = validateTeamNickname("Knights", {
      city: "Atlanta",
      existingTeams: [{ id: "team_atl", city: "Atlanta", name: "Knights" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Atlanta Knights/);
    }
  });

  it("excludes the current team from identity conflicts", () => {
    const result = validateTeamNickname("Knights", {
      city: "Atlanta",
      excludeTeamId: "team_atl",
      existingTeams: [{ id: "team_atl", city: "Atlanta", name: "Knights" }],
    });
    expect(result).toEqual({ ok: true, value: "Knights" });
  });
});

describe("nextNicknameFromPool", () => {
  it("cycles to the next unused nickname", () => {
    expect(nextNicknameFromPool("Knights", ["Knights", "Storm", "Hawks"])).toBe(
      "Storm",
    );
    expect(
      nextNicknameFromPool("Storm", ["Knights", "Storm", "Hawks"], ["Hawks"]),
    ).toBe("Knights");
  });

  it("returns null when every other nickname is used", () => {
    expect(
      nextNicknameFromPool("Knights", ["Knights", "Storm"], ["Storm"]),
    ).toBeNull();
  });
});
