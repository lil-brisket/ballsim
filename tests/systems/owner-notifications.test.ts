import { describe, expect, it } from "vitest";
import { createOwnerNotification } from "@/domain/entities/owner-notification";
import { asOwnerNotificationId, asOwnerObjectiveId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { createInitialGameState } from "@/state/create-initial-state";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { addCalendarDays } from "@/domain/calendar-date";
import {
  generateOwnerNotifications,
  retainOwnerNotifications,
} from "@/systems/owner-notifications";
import {
  OWNER_NOTIFICATIONS_MAX,
  SIGNIFICANT_FINANCIAL_CHANGE,
} from "@/systems/owner-objectives-config";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createDomainEvent } from "@/domain/events";
import { testOwnerObjective as createOwnerObjective } from "../helpers/owner-objective";
import {
  getActiveOwnedFranchise,
  withOwnedFranchise,
} from "@/state/owner-context";

describe("owner notifications", () => {
  it("emits objective completed and failed notifications without duplicates", () => {
    let state = createInitialGameState({
      saveId: "notif_obj",
      rngSeed: 5,
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
      getActiveOwnedFranchise(once.state).notifications.some(
        (n) => n.type === "objective_completed",
      ),
    ).toBe(true);
    expect(
      getActiveOwnedFranchise(once.state).notifications.some(
        (n) => n.type === "objective_failed",
      ),
    ).toBe(true);
    const twice = generateOwnerNotifications(once.state);
    expect(getActiveOwnedFranchise(twice.state).notifications).toHaveLength(
      getActiveOwnedFranchise(once.state).notifications.length,
    );
  });

  it("emits playoff qualification and season milestone notifications", () => {
    let state = createInitialGameState({
      saveId: "notif_po",
      rngSeed: 6,
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
    const reviewTypes = getActiveOwnedFranchise(review.state).notifications.map(
      (n) => n.type,
    );
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
    const offTypes = getActiveOwnedFranchise(off.state).notifications.map(
      (n) => n.type,
    );
    expect(offTypes).toContain("offseason_began");
  });

  it("emits significant financial change from pre/post cash delta", () => {
    let state = createInitialGameState({
      saveId: "notif_cash",
      rngSeed: 7,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const teamId = state.user.activeOwnerTeamId;
    const previousCash = state.business.finances[teamId]!.businessFunds;
    state = {
      ...state,
      business: {
        ...state.business,
        finances: {
          ...state.business.finances,
          [teamId]: {
            ...state.business.finances[teamId]!,
            businessFunds: previousCash + SIGNIFICANT_FINANCIAL_CHANGE,
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
      saveId: "notif_dedupe",
      rngSeed: 8,
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
      getActiveOwnedFranchise(sellout.state).notifications.some(
        (n) => n.type === "home_sellout",
      ),
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
      getActiveOwnedFranchise(poor.state).notifications.some(
        (n) => n.type === "poor_attendance",
      ),
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
          [teamId]: { ...state.business.finances[teamId]!, businessFunds: -1 },
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

  it("marks notifications older than the unread window as read even without new events", () => {
    let state = createInitialGameState({
      saveId: "notif_age",
      rngSeed: 9,
      settings: CBL_GAME_SETTINGS,
    });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;
    const date = state.world.calendar.currentDate;
    const teamId = state.user.activeOwnerTeamId;
    state = withOwnedFranchise(state, teamId, (franchise) => ({
      ...franchise,
      notifications: [
        createOwnerNotification({
          id: asOwnerNotificationId("notif_stale"),
          type: "calendar_milestone",
          title: "Old milestone",
          message: "From a prior season",
          occurredOn: addCalendarDays(date, -91),
          severity: "info",
          read: false,
          dedupeKey: "stale:old",
          relatedTeamId: teamId,
        }),
        createOwnerNotification({
          id: asOwnerNotificationId("notif_recent"),
          type: "calendar_milestone",
          title: "Recent milestone",
          message: "Still actionable",
          occurredOn: addCalendarDays(date, -10),
          severity: "warning",
          read: false,
          dedupeKey: "recent:new",
          relatedTeamId: teamId,
        }),
      ],
    }));
    const result = generateOwnerNotifications(state);
    const notes = getActiveOwnedFranchise(result.state).notifications;
    expect(notes.find((n) => n.id === "notif_stale")?.read).toBe(true);
    expect(notes.find((n) => n.id === "notif_recent")?.read).toBe(false);
  });

  it("drops oldest read calendar notifications once over the storage cap", () => {
    const date = "2026-10-01";
    const notes = Array.from({ length: OWNER_NOTIFICATIONS_MAX + 5 }, (_, i) =>
      createOwnerNotification({
        id: asOwnerNotificationId(`notif_cap_${i}`),
        type: "calendar_milestone",
        title: "Cap filler",
        message: `Entry ${i}`,
        occurredOn: addCalendarDays(date, -200 + i),
        severity: "info",
        read: true,
        dedupeKey: `cap:${i}`,
      }),
    );
    const retained = retainOwnerNotifications(notes, date);
    expect(retained).toHaveLength(OWNER_NOTIFICATIONS_MAX);
    expect(retained[0]?.id).toBe("notif_cap_5");
  });

  it("keeps completed-objective notifications when trimming history", () => {
    const date = "2026-10-01";
    const objective = createOwnerNotification({
      id: asOwnerNotificationId("notif_obj_keep"),
      type: "objective_completed",
      title: "Objective completed",
      message: "Make playoffs",
      occurredOn: addCalendarDays(date, -200),
      severity: "success",
      read: true,
      dedupeKey: "objective_completed:obj_keep",
      relatedObjectiveId: asOwnerObjectiveId("obj_keep"),
    });
    const filler = Array.from({ length: OWNER_NOTIFICATIONS_MAX }, (_, i) =>
      createOwnerNotification({
        id: asOwnerNotificationId(`notif_fill_${i}`),
        type: "home_sellout",
        title: "Sellout",
        message: `Game ${i}`,
        occurredOn: addCalendarDays(date, -180 + i),
        severity: "info",
        read: true,
        dedupeKey: `sellout:${i}`,
      }),
    );
    const retained = retainOwnerNotifications([objective, ...filler], date);
    expect(retained.some((n) => n.type === "objective_completed")).toBe(true);
    expect(retained).toHaveLength(OWNER_NOTIFICATIONS_MAX);
  });
});
