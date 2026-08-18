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

describe("owner notifications", () => {
  it("emits objective completed and failed notifications without duplicates", () => {
    let state = createInitialGameState({
    saveId: "notif_obj", rngSeed: 5,
    settings: CBL_GAME_SETTINGS,
  });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const year = state.competition.season.year;
    state = {
      ...state,
      user: {
        ...state.user,
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
      },
    };
    const once = generateOwnerNotifications(state);
    expect(
      once.state.user.notifications.some((n) => n.type === "objective_completed"),
    ).toBe(true);
    expect(
      once.state.user.notifications.some((n) => n.type === "objective_failed"),
    ).toBe(true);
    const twice = generateOwnerNotifications(once.state);
    expect(twice.state.user.notifications).toHaveLength(
      once.state.user.notifications.length,
    );
  });

  it("emits playoff qualification and season milestone notifications", () => {
    let state = createInitialGameState({
    saveId: "notif_po", rngSeed: 6,
    settings: CBL_GAME_SETTINGS,
  });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.controlledTeamId;
    state = {
      ...state,
      competition: {
        ...state.competition,
        season: { ...state.competition.season, phase: "offseason" },
        playoffs: {
          status: "complete",
          fieldSize: 8,
          qualifiedTeams: [{ teamId, seed: 2 }],
          series: [],
          championTeamId: teamId,
        },
      },
    };
    const result = generateOwnerNotifications(state);
    const types = result.state.user.notifications.map((n) => n.type);
    expect(types).toContain("playoff_qualified");
    expect(types).toContain("season_completed");
    expect(types).toContain("offseason_began");
  });

  it("emits significant financial change from pre/post cash delta", () => {
    let state = createInitialGameState({
    saveId: "notif_cash", rngSeed: 7,
    settings: CBL_GAME_SETTINGS,
  });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.controlledTeamId;
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
      result.state.user.notifications.some(
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
      user: {
        ...state.user,
        notifications: [existing],
      },
    };
    const result = generateOwnerNotifications(state);
    expect(
      result.state.user.notifications.filter(
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
    const teamId = state.user.controlledTeamId;
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
      sellout.state.user.notifications.some((n) => n.type === "home_sellout"),
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
      poor.state.user.notifications.some((n) => n.type === "poor_attendance"),
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
    const teamId = state.user.controlledTeamId;
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
      once.state.user.notifications.some(
        (n) => n.type === "financial_health_changed",
      ),
    ).toBe(true);
    const twice = generateOwnerNotifications(once.state);
    expect(
      twice.state.user.notifications.filter(
        (n) => n.type === "financial_health_changed",
      ),
    ).toHaveLength(1);
  });
});
