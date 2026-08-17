import {
  createOwnerNotification,
  type OwnerNotification,
} from "@/domain/entities/owner-notification";
import type { DomainEvent } from "@/domain/events";
import { asOwnerNotificationId, type TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { projectCashHorizon } from "@/systems/cash-projection";
import {
  calculateFinancialHealth,
  type FinancialHealthState,
} from "@/systems/financial-health";
import {
  AWARENESS_NOTIFICATION_BANDS,
  OWNER_STREAK_NOTIFICATION_THRESHOLD,
  POOR_ATTENDANCE_FILL_RATE_PCT,
  SIGNIFICANT_FINANCIAL_CHANGE,
} from "@/systems/owner-objectives-config";

export type GenerateOwnerNotificationsOptions = {
  /** Controlled-team cash before applyGameplayFinancialConsequences in this pass. */
  previousCash?: number;
  /** Same-day events not yet appended to user.eventLog. */
  dayEvents?: readonly DomainEvent[];
};

/**
 * Appends owner-facing notifications for state transitions.
 * Idempotent via dedupeKey (identity only; not a snapshot store).
 */
export function generateOwnerNotifications(
  state: GameState,
  options: GenerateOwnerNotificationsOptions = {},
): SystemResult {
  const teamId = state.user.controlledTeamId;
  const date = state.world.calendar.currentDate;
  const existingKeys = new Set(
    state.user.notifications.map((notification) => notification.dedupeKey),
  );
  const additions: OwnerNotification[] = [];

  const append = (notification: OwnerNotification): void => {
    if (existingKeys.has(notification.dedupeKey)) {
      return;
    }
    existingKeys.add(notification.dedupeKey);
    additions.push(notification);
  };

  for (const objective of state.user.objectives) {
    if (objective.status === "completed") {
      append(
        createOwnerNotification({
          id: asOwnerNotificationId(`notif_obj_complete_${objective.id}`),
          type: "objective_completed",
          title: "Objective completed",
          message: objective.description,
          occurredOn: date,
          severity: "success",
          read: false,
          dedupeKey: `objective_completed:${objective.id}`,
          relatedObjectiveId: objective.id,
          relatedTeamId: teamId,
        }),
      );
    }
    if (objective.status === "failed") {
      append(
        createOwnerNotification({
          id: asOwnerNotificationId(`notif_obj_failed_${objective.id}`),
          type: "objective_failed",
          title: "Objective failed",
          message: objective.description,
          occurredOn: date,
          severity: "warning",
          read: false,
          dedupeKey: `objective_failed:${objective.id}`,
          relatedObjectiveId: objective.id,
          relatedTeamId: teamId,
        }),
      );
    }
  }

  if (
    state.competition.playoffs.qualifiedTeams.some(
      (seed) => seed.teamId === teamId,
    )
  ) {
    append(
      createOwnerNotification({
        id: asOwnerNotificationId(
          `notif_playoff_qualified_${teamId}_${state.competition.season.year}`,
        ),
        type: "playoff_qualified",
        title: "Playoff qualification",
        message: "Your team has qualified for the playoffs.",
        occurredOn: date,
        severity: "success",
        read: false,
        dedupeKey: `playoff_qualified:${teamId}:${state.competition.season.year}`,
        relatedTeamId: teamId,
      }),
    );
  }

  if (isPlayoffEliminated(state, teamId)) {
    append(
      createOwnerNotification({
        id: asOwnerNotificationId(
          `notif_playoff_eliminated_${teamId}_${state.competition.season.year}`,
        ),
        type: "playoff_eliminated",
        title: "Playoff elimination",
        message: "Your team has been eliminated from the playoffs.",
        occurredOn: date,
        severity: "warning",
        read: false,
        dedupeKey: `playoff_eliminated:${teamId}:${state.competition.season.year}`,
        relatedTeamId: teamId,
      }),
    );
  }

  const streak = state.competition.standings.byTeamId[teamId]?.streak;
  if (
    streak &&
    streak.type === "W" &&
    streak.count >= OWNER_STREAK_NOTIFICATION_THRESHOLD
  ) {
    append(
      createOwnerNotification({
        id: asOwnerNotificationId(
          `notif_win_streak_${teamId}_${state.competition.season.year}_${streak.count}`,
        ),
        type: "winning_streak",
        title: "Winning streak",
        message: `Your team has won ${streak.count} games in a row.`,
        occurredOn: date,
        severity: "info",
        read: false,
        dedupeKey: `winning_streak:${teamId}:${state.competition.season.year}:${streak.count}`,
        relatedTeamId: teamId,
      }),
    );
  }
  if (
    streak &&
    streak.type === "L" &&
    streak.count >= OWNER_STREAK_NOTIFICATION_THRESHOLD
  ) {
    append(
      createOwnerNotification({
        id: asOwnerNotificationId(
          `notif_lose_streak_${teamId}_${state.competition.season.year}_${streak.count}`,
        ),
        type: "losing_streak",
        title: "Losing streak",
        message: `Your team has lost ${streak.count} games in a row.`,
        occurredOn: date,
        severity: "warning",
        read: false,
        dedupeKey: `losing_streak:${teamId}:${state.competition.season.year}:${streak.count}`,
        relatedTeamId: teamId,
      }),
    );
  }

  const healthChanged = appendFinancialHealthTransition(
    state,
    teamId,
    date,
    append,
  );

  if (options.previousCash !== undefined && !healthChanged) {
    const currentCash = state.business.finances[teamId]?.cash ?? 0;
    const delta = currentCash - options.previousCash;
    if (Math.abs(delta) >= SIGNIFICANT_FINANCIAL_CHANGE) {
      append(
        createOwnerNotification({
          id: asOwnerNotificationId(
            `notif_fin_change_${teamId}_${date}`,
          ),
          type: "significant_financial_change",
          title: "Significant financial change",
          message:
            delta > 0
              ? `Team cash increased by ${delta}.`
              : `Team cash decreased by ${Math.abs(delta)}.`,
          occurredOn: date,
          severity: delta > 0 ? "success" : "warning",
          read: false,
          dedupeKey: `significant_financial_change:${teamId}:${date}`,
          relatedTeamId: teamId,
        }),
      );
    }
  }

  appendGameDayAttendanceNotifications(
    state,
    teamId,
    date,
    options.dayEvents ?? [],
    append,
  );
  appendAwarenessBandNotification(state, teamId, date, append);

  const phase = state.competition.season.phase;
  if (phase === "postseason" || phase === "offseason") {
    append(
      createOwnerNotification({
        id: asOwnerNotificationId(
          `notif_season_completed_${state.competition.season.year}`,
        ),
        type: "season_completed",
        title: "Season completed",
        message: `The ${state.competition.season.year} season has concluded.`,
        occurredOn: date,
        severity: "info",
        read: false,
        dedupeKey: `season_completed:${state.competition.season.year}`,
        relatedTeamId: teamId,
      }),
    );
  }
  if (phase === "offseason") {
    append(
      createOwnerNotification({
        id: asOwnerNotificationId(
          `notif_offseason_began_${state.competition.season.year}`,
        ),
        type: "offseason_began",
        title: "Offseason began",
        message: "The offseason has begun.",
        occurredOn: date,
        severity: "info",
        read: false,
        dedupeKey: `offseason_began:${state.competition.season.year}`,
        relatedTeamId: teamId,
      }),
    );
  }

  if (additions.length === 0) {
    return systemResult(state);
  }

  return systemResult({
    ...state,
    user: {
      ...state.user,
      notifications: [...state.user.notifications, ...additions],
    },
  });
}

function appendGameDayAttendanceNotifications(
  state: GameState,
  teamId: TeamId,
  date: string,
  dayEvents: readonly DomainEvent[],
  append: (notification: OwnerNotification) => void,
): void {
  const candidates = [
    ...dayEvents,
    ...state.user.eventLog,
  ].filter(
    (event) =>
      event.type === "HomeGameDaySettled" &&
      event.payload.teamId === teamId &&
      event.occurredOn === date,
  );

  const seenGames = new Set<string>();
  for (const event of candidates) {
    const gameId = String(event.payload.gameId ?? event.id);
    if (seenGames.has(gameId)) {
      continue;
    }
    seenGames.add(gameId);

    const attendance = Number(event.payload.attendance) || 0;
    const capacity = Number(event.payload.capacity) || 0;
    if (capacity <= 0) {
      continue;
    }
    const fillPct = Math.round((attendance / capacity) * 100);
    if (attendance >= capacity) {
      append(
        createOwnerNotification({
          id: asOwnerNotificationId(`notif_sellout_${teamId}_${gameId}`),
          type: "home_sellout",
          title: "Home sellout",
          message: `The arena sold out (${attendance.toLocaleString()} / ${capacity.toLocaleString()}).`,
          occurredOn: date,
          severity: "success",
          read: false,
          dedupeKey: `home_sellout:${teamId}:${gameId}`,
          relatedTeamId: teamId,
        }),
      );
    } else if (fillPct < POOR_ATTENDANCE_FILL_RATE_PCT) {
      append(
        createOwnerNotification({
          id: asOwnerNotificationId(`notif_poor_att_${teamId}_${gameId}`),
          type: "poor_attendance",
          title: "Poor attendance",
          message: `Home attendance was only ${fillPct}% of capacity (${attendance.toLocaleString()} / ${capacity.toLocaleString()}).`,
          occurredOn: date,
          severity: "warning",
          read: false,
          dedupeKey: `poor_attendance:${teamId}:${gameId}`,
          relatedTeamId: teamId,
        }),
      );
    }
  }
}

function appendAwarenessBandNotification(
  state: GameState,
  teamId: TeamId,
  date: string,
  append: (notification: OwnerNotification) => void,
): void {
  const awareness =
    state.business.franchiseOps[teamId]?.marketing.awareness ?? 0;
  for (const band of AWARENESS_NOTIFICATION_BANDS) {
    if (awareness < band) {
      continue;
    }
    append(
      createOwnerNotification({
        id: asOwnerNotificationId(
          `notif_awareness_${teamId}_${state.competition.season.year}_${band}`,
        ),
        type: "awareness_band",
        title: "Awareness milestone",
        message: `Franchise awareness reached ${band} (currently ${awareness}).`,
        occurredOn: date,
        severity: "info",
        read: false,
        dedupeKey: `awareness_band:${teamId}:${state.competition.season.year}:${band}`,
        relatedTeamId: teamId,
      }),
    );
  }
}

function lastRecordedHealth(
  state: GameState,
  teamId: TeamId,
): FinancialHealthState | null {
  for (let index = state.user.notifications.length - 1; index >= 0; index -= 1) {
    const notification = state.user.notifications[index]!;
    if (notification.type !== "financial_health_changed") {
      continue;
    }
    if (notification.relatedTeamId !== teamId) {
      continue;
    }
    const parts = notification.dedupeKey.split(":");
    const health = parts[parts.length - 1];
    if (
      health === "healthy" ||
      health === "stable" ||
      health === "warning" ||
      health === "critical" ||
      health === "insolvent"
    ) {
      return health;
    }
  }
  return null;
}

function healthMessage(
  health: FinancialHealthState,
  pressure: string,
  projectedCash: number,
  runwayWeeks: number | null,
): { title: string; message: string; severity: OwnerNotification["severity"] } {
  const pressureLabel =
    pressure === "player_payroll"
      ? "player payroll"
      : pressure;
  const runwayText =
    runwayWeeks === null
      ? "Projected cash stays non-negative over the current horizon if conditions hold."
      : `At current conditions, cash is projected to run out in about ${runwayWeeks} weeks.`;
  if (health === "insolvent") {
    return {
      title: "Franchise insolvent",
      message: `Cash is at or below zero. ${pressureLabel} is the largest operating outflow. Facility upgrades and marketing increases are blocked until inflows recover.`,
      severity: "critical",
    };
  }
  if (health === "critical") {
    return {
      title: "Critical financial risk",
      message: `Projected cash at season/horizon is ${projectedCash < 0 ? "negative" : "thin"} because ${pressureLabel} dominates spending. ${runwayText} Cut spending or raise game-day revenue.`,
      severity: "critical",
    };
  }
  if (health === "warning") {
    return {
      title: "Financial warning",
      message: `${pressureLabel} is the primary cost pressure. ${runwayText} Further spending increases would add risk.`,
      severity: "warning",
    };
  }
  if (health === "healthy") {
    return {
      title: "Financial health improved",
      message: `Operating cash flow covers spending with a liquidity buffer. ${runwayText}`,
      severity: "success",
    };
  }
  return {
    title: "Finances stabilized",
    message: `The franchise has limited margin but is no longer in immediate distress. ${runwayText}`,
    severity: "success",
  };
}

function appendFinancialHealthTransition(
  state: GameState,
  teamId: TeamId,
  date: string,
  append: (notification: OwnerNotification) => void,
): boolean {
  const projection = projectCashHorizon(state, teamId);
  const cash = state.business.finances[teamId]?.cash ?? 0;
  const health = calculateFinancialHealth({
    cash,
    weeklyOutflow: projection.weeklyOutflow,
    netWeeklyBurn: projection.netWeeklyBurn,
    runwayWeeks: projection.runwayWeeks,
    projectedCash: projection.projectedCash,
  });
  const previous = lastRecordedHealth(state, teamId);
  if (previous === health) {
    return false;
  }
  if (previous === null && (health === "healthy" || health === "stable")) {
    return false;
  }
  const copy = healthMessage(
    health,
    projection.primaryPressure,
    projection.projectedCash,
    projection.runwayWeeks,
  );
  append(
    createOwnerNotification({
      id: asOwnerNotificationId(
        `notif_health_${teamId}_${date}_${health}`,
      ),
      type: "financial_health_changed",
      title: copy.title,
      message: copy.message,
      occurredOn: date,
      severity: copy.severity,
      read: false,
      dedupeKey: `financial_health_changed:${teamId}:${date}:${health}`,
      relatedTeamId: teamId,
    }),
  );
  return true;
}

function isPlayoffEliminated(state: GameState, teamId: TeamId): boolean {
  const playoffs = state.competition.playoffs;
  if (playoffs.status === "not_started") {
    return false;
  }
  const qualified = playoffs.qualifiedTeams.some(
    (seed) => seed.teamId === teamId,
  );
  if (!qualified) {
    return false;
  }
  if (playoffs.championTeamId === teamId) {
    return false;
  }
  for (const series of playoffs.series) {
    const participates =
      series.higherSeedTeamId === teamId || series.lowerSeedTeamId === teamId;
    if (
      participates &&
      series.status === "complete" &&
      series.winnerTeamId !== undefined &&
      series.winnerTeamId !== teamId
    ) {
      return true;
    }
  }
  return playoffs.status === "complete" && playoffs.championTeamId !== teamId;
}
