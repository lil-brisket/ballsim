import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { asTeamId } from "@/domain/ids";
import { toSheetPlayerView } from "@/state/roster-sheet-view";
import { toTeamRosterView } from "@/state/team-roster-view";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createTestGameState } from "../factories/game-state";

const base = bootstrapWorld(
  createTestGameState({ saveId: "team_roster" }),
  createSeededRng("team-roster"),
).state;
const userTeamId = base.user.activeOwnerTeamId!;
const otherTeam = Object.values(base.world.teams).find(
  (t) => t.id !== userTeamId,
)!;

describe("toTeamRosterView", () => {
  it("lists the roster players with their public contract info", () => {
    const view = toTeamRosterView(base, otherTeam.id, "team_roster")!;
    expect(view.players.map((p) => p.playerId)).toEqual(
      otherTeam.roster.map(String),
    );
    for (const row of view.players) {
      const expected = toSheetPlayerView(base, row.playerId as never)!;
      expect(row.contractSalary).toBe(expected.contractSalary);
      expect(row.contractYearsRemaining).toBe(expected.contractYearsRemaining);
      expect(row.contractSalary).not.toBeNull();
      expect("rotationRole" in row).toBe(false);
      expect("onTradeBlock" in row).toBe(false);
    }
    expect(view.isUserTeam).toBe(false);
    expect(view.abbreviation).toBe(otherTeam.abbreviation);
  });

  it("flags the user's own team", () => {
    expect(toTeamRosterView(base, userTeamId, "team_roster")!.isUserTeam).toBe(
      true,
    );
  });

  it("shows an injured player's availability label", () => {
    const victimId = otherTeam.roster[0]!;
    const state = {
      ...base,
      world: {
        ...base.world,
        players: {
          ...base.world.players,
          [victimId]: {
            ...base.world.players[victimId]!,
            availability: "out" as const,
          },
        },
      },
    };
    const row = toTeamRosterView(state, otherTeam.id, "team_roster")!
      .players[0]!;
    expect(row.canPlay).toBe(false);
    expect(row.availabilityLabel).toMatch(/^Out/);
  });

  it("returns null for an unknown team", () => {
    expect(toTeamRosterView(base, asTeamId("nope"), "team_roster")).toBeNull();
  });

  it("lists every team in the picker, sorted, with hrefs", () => {
    const view = toTeamRosterView(base, otherTeam.id, "team_roster")!;
    expect(view.teams).toHaveLength(Object.keys(base.world.teams).length);
    const entry = view.teams.find((t) => t.teamId === String(otherTeam.id))!;
    expect(entry.href).toBe(
      `/dashboard/team_roster/league/teams/${otherTeam.id}`,
    );
    const cities = view.teams.map(
      (t) => base.world.teams[asTeamId(t.teamId)]!.city,
    );
    expect(cities).toEqual([...cities].sort((a, b) => a.localeCompare(b)));
  });
});
