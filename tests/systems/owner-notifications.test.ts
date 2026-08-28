import { describe, expect, it } from "vitest";
import { createOwnerNotification } from "@/domain/entities/owner-notification";
import { asOwnerNotificationId, asOwnerObjectiveId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { generateOwnerNotifications } from "@/systems/owner-notifications";
import { SIGNIFICANT_FINANCIAL_CHANGE } from "@/systems/owner-objectives-config";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createDomainEvent } from "@/domain/events";
import { testOwnerObjective as createOwnerObjective } from "../helpers/owner-objective";
import { getActiveOwnedFranchise, withOwnedFranchise } from "@/state/owner-context";

describe("owner notifications", () => {
  it("emits objective completed and failed notifications without duplicates", () => {
    let state = createInitialGameState({
    saveId: "notif_obj", rngSeed: 5,
    settings: CBL_GAME_SETTINGS,
  });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const year = state.competition.season.year;
    state = withOwnedFranchise(state, state.user.activeOwnerTeamId, (f) => ({
      ...f,
      objectives: [
        createOwnerObjective({
          id: asOwnerObjectiveId("obj_c"),
          type: "make_playoffs",
          description: "Make playoffs",
          status: "completed",
          seasonYear: year,
          consequenceApplied: true,
        }),
        createOwnerObjective({
          id: asOwnerObjectiveId("obj_f"),
          type: "minimum_win_total",
          description: "Win 40",
          status: "failed",
          seasonYear: year,
          target: 40,
          consequenceApplied: true,
        }),
      ],
    }));
    const once = generateOwnerNotifications(state);
    expect(
      getActiveOwnedFranchise(once.state).notifications.some((n) => n.type === "objective_completed"),
    ).toBe(true);
    expect(
      getActiveOwnedFranchise(once.state).notifications.some((n) => n.type === "objective_failed"),
    ).toBe(true);
    const twice = generateOwnerNotifications(once.state);
    expect(getActiveOwnedFranchise(twice.state).notifications).toHaveLength(
      getActiveOwnedFranchise(once.state).notifications.length,
    );
  });

  it("emits playoff qualification and season milestone notifications", () => {
    let state = createInitialGameState({
    saveId: "notif_po", rngSeed: 6,
    settings: CBL_GAME_SETTINGS,
  });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.activeOwnerTeamId;
    const postseasonState = {
      ...state,
      competition: {
        ...state.competition,
        season: { ...state.competition.season, phase: "postseason" as const },
        playoffs: {
          status: "complete" as const,
          fieldSize: 8,
          qualifiedTeams: [{ teamId, seed: 2 }],
          series: [],
          championTeamId: teamId,
        },
      },
    };
    const review = generateOwnerNotifications(postseasonState);
    const reviewTypes = getActiveOwnedFranchise(review.state).notifications.map((n) => n.type);
    expect(reviewTypes).toContain("playoff_qualified");
    expect(reviewTypes).toContain("season_completed");

    const offseasonState = {
      ...postseasonState,
      competition: {
        ...postseasonState.competition,
        season: {
          ...postseasonState.competition.season,
          phase: "offseason" as const,
        },
      },
    };
    const off = generateOwnerNotifications(offseasonState);
    const offTypes = getActiveOwnedFranchise(off.state).notifications.map((n) => n.type);
    expect(offTypes).toContain("offseason_began");
  });

  it("emits significant financial change from pre/post cash delta", () => {
    let state = createInitialGameState({
    saveId: "notif_cash", rngSeed: 7,
    settings: CBL_GAME_SETTINGS,
  });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.activeOwnerTeamId;
    const previousCash = state.business.finances[teamId]!.cash;
    state = {
      ...state,
      business: {
        ...state.business,
        finances: {
          ...state.business.finances,
          [teamId]: {
            ...state.business.finances[teamId]!,
            cash: previousCash + SIGNIFICANT_FINANCIAL_CHANGE,
          },
        },
      },
    };
    const result = generateOwnerNotifications(state, { previousCash });
    expect(
      getActiveOwnedFranchise(result.state).notifications.some(
        (n) => n.type === "significant_financial_change",
      ),
    ).toBe(true);
  });

  it("skips existing dedupeKey", () => {
    let state = createInitialGameState({
    saveId: "notif_dedupe", rngSeed: 8,
    settings: CBL_GAME_SETTINGS,
  });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const year = state.competition.season.year;
    const existing = createOwnerNotification({
      id: asOwnerNotificationId("n1"),
      type: "season_completed",
      title: "Season completed",
      message: "done",
      occurredOn: state.world.calendar.currentDate,
      severity: "info",
      read: false,
      dedupeKey: `season_completed:${year}`,
    });
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: { ...state.competition.season, phase: "postseason" },
      },
    };
    state = withOwnedFranchise(state, state.user.activeOwnerTeamId, (f) => ({
      ...f,
      notifications: [existing],
    }));
    const result = generateOwnerNotifications(state);
    expect(
      getActiveOwnedFranchise(result.state).notifications.filter(
        (n) => n.dedupeKey === `season_completed:${year}`,
      ),
    ).toHaveLength(1);
  });

  it("emits sellout and poor attendance from HomeGameDaySettled", () => {
    let state = createInitialGameState({
      saveId: "notif_att",
      rngSeed: 9,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.activeOwnerTeamId;
    const date = state.world.calendar.currentDate;
    const sellout = generateOwnerNotifications(state, {
      dayEvents: [
        createDomainEvent({
          type: "HomeGameDaySettled",
          occurredOn: date,
          payload: {
            teamId,
            gameId: "g1",
            attendance: 12_000,
            capacity: 12_000,
          },
        }),
      ],
    });
    expect(
      getActiveOwnedFranchise(sellout.state).notifications.some((n) => n.type === "home_sellout"),
    ).toBe(true);

    const poor = generateOwnerNotifications(state, {
      dayEvents: [
        createDomainEvent({
          type: "HomeGameDaySettled",
          occurredOn: date,
          payload: {
            teamId,
            gameId: "g2",
            attendance: 1_000,
            capacity: 12_000,
          },
        }),
      ],
    });
    expect(
      getActiveOwnedFranchise(poor.state).notifications.some((n) => n.type === "poor_attendance"),
    ).toBe(true);
  });

  it("emits financial health transition when cash is insolvent", () => {
    let state = createInitialGameState({
      saveId: "notif_health",
      rngSeed: 10,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.activeOwnerTeamId;
    state = {
      ...state,
      business: {
        ...state.business,
        finances: {
          ...state.business.finances,
          [teamId]: { ...state.business.finances[teamId]!, cash: -1 },
        },
      },
    };
    const once = generateOwnerNotifications(state);
    expect(
      getActiveOwnedFranchise(once.state).notifications.some(
        (n) => n.type === "financial_health_changed",
      ),
    ).toBe(true);
    const twice = generateOwnerNotifications(once.state);
    expect(
      getActiveOwnedFranchise(twice.state).notifications.filter(
        (n) => n.type === "financial_health_changed",
      ),
    ).toHaveLength(1);
  });
});
