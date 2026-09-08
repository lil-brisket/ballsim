import { describe, expect, it } from "vitest";
import { createContract } from "@/domain/entities/contract";
import { asContractId, asPlayerId, asTeamId } from "@/domain/ids";
import {
  toPlayerDrawerView,
  toTeamDrawerView,
} from "@/state/entity-drawer-selectors";
import type { GameState } from "@/state/game-state";
import { getOwnedTeamIds } from "@/state/owner-context";
import { resolveTeamHref } from "@/state/resolve-team-href";
import { getControlledTeam } from "@/state/selectors";
import { createTestGameState } from "../factories/game-state";
import { createPlayer } from "../factories/player";

function withSeededRosters(base: GameState): GameState {
  const controlled = getControlledTeam(base);
  const other = Object.values(base.world.teams).find(
    (t) => t.id !== controlled.id,
  )!;
  const year = base.competition.season.year;

  const controlledPlayerId = asPlayerId("player_drawer_ctrl");
  const otherPlayerId = asPlayerId("player_drawer_opp");
  const contractId = asContractId("contract_drawer_ctrl");

  const controlledPlayer = createPlayer({
    id: controlledPlayerId,
    teamId: controlled.id,
    firstName: "Casey",
    lastName: "Control",
    contractId,
  });
  const otherPlayer = createPlayer({
    id: otherPlayerId,
    teamId: other.id,
    firstName: "Omar",
    lastName: "Opponent",
    contractId: null,
  });
  const contract = createContract({
    id: contractId,
    playerId: controlledPlayerId,
    teamId: controlled.id,
    startYear: year,
    endYear: year + 2,
    salaryByYear: {
      [String(year)]: 5_000_000,
      [String(year + 1)]: 5_200_000,
      [String(year + 2)]: 5_400_000,
    },
  });

  return {
    ...base,
    world: {
      ...base.world,
      players: {
        ...base.world.players,
        [controlledPlayerId]: controlledPlayer,
        [otherPlayerId]: otherPlayer,
      },
      teams: {
        ...base.world.teams,
        [controlled.id]: {
          ...controlled,
          roster: [...controlled.roster, controlledPlayerId],
        },
        [other.id]: {
          ...other,
          roster: [...other.roster, otherPlayerId],
        },
      },
    },
    business: {
      ...base.business,
      contracts: {
        ...base.business.contracts,
        [contractId]: contract,
      },
    },
  };
}

describe("resolveTeamHref", () => {
  it("routes active franchise to /team, owned to /teams, else /league", () => {
    const state = createTestGameState({ saveId: "save_drawer" });
    const activeId = state.user.activeOwnerTeamId;
    const ownedIds = getOwnedTeamIds(state);
    const otherOwned = ownedIds.find((id) => id !== activeId);
    const allTeams = Object.keys(state.world.teams);
    const unowned = allTeams.find(
      (id) => id !== activeId && !ownedIds.includes(asTeamId(id)),
    );

    expect(resolveTeamHref(state, activeId, "save_drawer")).toBe(
      "/dashboard/save_drawer/team",
    );
    if (otherOwned) {
      expect(resolveTeamHref(state, otherOwned, "save_drawer")).toBe(
        "/dashboard/save_drawer/teams",
      );
    }
    if (unowned) {
      expect(
        resolveTeamHref(state, asTeamId(unowned), "save_drawer"),
      ).toBe("/dashboard/save_drawer/league");
    }
  });
});

describe("toPlayerDrawerView", () => {
  it("returns public fields for a roster player", () => {
    const state = withSeededRosters(
      createTestGameState({ saveId: "save_drawer" }),
    );
    const team = getControlledTeam(state);
    const playerId = team.roster[0];
    expect(playerId).toBeTruthy();

    const view = toPlayerDrawerView(
      state,
      asPlayerId(playerId!),
      "save_drawer",
    );
    expect(view).not.toBeNull();
    expect(view!.identity.firstName).toBe("Casey");
    expect(view!.identity.overall).toBeGreaterThan(0);
    expect(view!.availability.status).toBeTruthy();
    expect(view!.navigation.playerHref).toContain(`/players/${playerId}`);
  });

  it("includes contract only for controlled roster players", () => {
    const state = withSeededRosters(
      createTestGameState({ saveId: "save_drawer" }),
    );
    const controlled = getControlledTeam(state);
    const controlledId = controlled.roster[0]!;
    const controlledView = toPlayerDrawerView(
      state,
      asPlayerId(controlledId),
      "save_drawer",
    );
    expect(controlledView).not.toBeNull();
    expect(controlledView!.contract).not.toBeNull();
    expect(controlledView!.navigation.contractHref).toContain("/contracts");
    expect(controlledView!.navigation.developmentHref).toContain(
      "/development",
    );

    const otherTeam = Object.values(state.world.teams).find(
      (t) => t.id !== controlled.id && t.roster.length > 0,
    );
    expect(otherTeam).toBeTruthy();
    const oppId = otherTeam!.roster[0]!;
    const oppView = toPlayerDrawerView(
      state,
      asPlayerId(oppId),
      "save_drawer",
    );
    expect(oppView).not.toBeNull();
    expect(oppView!.contract).toBeNull();
    expect(oppView!.navigation.contractHref).toBeNull();
    expect(oppView!.navigation.developmentHref).toBeNull();
    expect(oppView!.identity.overall).toBeGreaterThan(0);
  });

  it("returns null for missing player", () => {
    const state = createTestGameState({ saveId: "save_drawer" });
    expect(
      toPlayerDrawerView(state, asPlayerId("player_missing"), "save_drawer"),
    ).toBeNull();
  });
});

describe("toTeamDrawerView", () => {
  it("builds identity and performance for any league team", () => {
    const state = withSeededRosters(
      createTestGameState({ saveId: "save_drawer" }),
    );
    const team = getControlledTeam(state);
    const view = toTeamDrawerView(state, team.id, "save_drawer");
    expect(view).not.toBeNull();
    expect(view!.identity.abbreviation).toBe(team.abbreviation);
    expect(view!.performance.rank).toBeGreaterThan(0);
    expect(view!.roster.topPlayers.length).toBeGreaterThan(0);
    expect(view!.navigation.scheduleHref).toContain("/schedule");
  });

  it("includes franchise context only for owned teams", () => {
    const state = withSeededRosters(
      createTestGameState({ saveId: "save_drawer" }),
    );
    const controlled = getControlledTeam(state);
    const ownedView = toTeamDrawerView(state, controlled.id, "save_drawer");
    expect(ownedView!.context).not.toBeNull();
    expect(ownedView!.context!.ownerStatus).toBe("active");
    expect(ownedView!.navigation.rosterHref).toContain("/roster");

    const unowned = Object.values(state.world.teams).find(
      (t) => t.id !== controlled.id,
    );
    expect(unowned).toBeTruthy();
    const publicView = toTeamDrawerView(state, unowned!.id, "save_drawer");
    expect(publicView!.context).toBeNull();
    expect(publicView!.navigation.rosterHref).toBeNull();
  });
});
