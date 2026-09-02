/**
 * Simulation state invariants for calendar-driven multi-day advances.
 * Lightweight per-day checks plus a fuller post-jump validation.
 */

import type { GameState } from "@/state/game-state";
import { resolvePhaseResolution } from "@/systems/league-rules/league-calendar";
import { getActivePhaseId } from "@/systems/phase-engine";

export type SimulationValidationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type SimulationValidationResult = {
  ok: boolean;
  issues: SimulationValidationIssue[];
};

function issue(
  code: string,
  message: string,
  severity: "error" | "warning" = "error",
): SimulationValidationIssue {
  return { code, message, severity };
}

/**
 * Fast checks after each simulated day.
 */
export function validateDayInvariants(
  state: GameState,
): SimulationValidationResult {
  const issues: SimulationValidationIssue[] = [];
  const date = state.world.calendar.currentDate;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    issues.push(issue("invalid_current_date", `Invalid currentDate "${date}".`));
  }

  const lastSim = state.world.calendar.lastSimulatedDate;
  if (lastSim !== null && lastSim > date) {
    issues.push(
      issue(
        "last_simulated_after_current",
        `lastSimulatedDate ${lastSim} is after currentDate ${date}.`,
      ),
    );
  }

  const activePhaseId = getActivePhaseId(state);
  const resolution = resolvePhaseResolution(state, date);
  const heldByResolver =
    resolution.reason === "blocking_decision" ||
    resolution.reason === "event_incomplete" ||
    resolution.blockedBy === "required_tasks" ||
    resolution.blockedBy === "owner_decision" ||
    resolution.blockedBy === "draft_incomplete" ||
    resolution.blockedBy === "preparation_incomplete" ||
    resolution.blockedBy === "fa_open";

  if (resolution.phaseId !== activePhaseId && !heldByResolver) {
    issues.push(
      issue(
        "phase_date_mismatch",
        `Active phase ${activePhaseId} does not match resolver target ${resolution.phaseId} (${resolution.reason}).`,
        "warning",
      ),
    );
  }

  for (const player of Object.values(state.world.players)) {
    if (player.teamId != null && state.world.teams[player.teamId] == null) {
      issues.push(
        issue(
          "orphan_player_team",
          `Player ${player.id} references missing team ${player.teamId}.`,
        ),
      );
      break;
    }
  }

  return {
    ok: issues.every((entry) => entry.severity !== "error"),
    issues,
  };
}

/**
 * Fuller validation after a large simulate-to-date jump.
 */
export function validateSimulationState(
  state: GameState,
): SimulationValidationResult {
  const day = validateDayInvariants(state);
  const issues = [...day.issues];

  if (
    state.competition.season.phase === "regular" ||
    state.competition.season.phase === "playoffs" ||
    state.competition.season.phase === "postseason"
  ) {
    for (const teamId of Object.keys(state.world.teams)) {
      if (state.competition.standings.byTeamId[teamId] == null) {
        issues.push(
          issue(
            "missing_standings_row",
            `Team ${teamId} has no standings row.`,
            "warning",
          ),
        );
      }
    }
  }

  for (const game of Object.values(state.competition.games)) {
    if (game.status === "final") {
      if (
        typeof game.score?.home !== "number" ||
        typeof game.score?.away !== "number"
      ) {
        issues.push(
          issue(
            "final_game_missing_score",
            `Final game ${game.id} is missing scores.`,
          ),
        );
        break;
      }
    }
  }

  const ok = issues.every((entry) => entry.severity !== "error");
  return { ok, issues };
}

/**
 * Throws when validation finds error-severity issues (dev/test).
 */
export function assertSimulationState(
  state: GameState,
  mode: "day" | "full" = "full",
): void {
  const result =
    mode === "day"
      ? validateDayInvariants(state)
      : validateSimulationState(state);
  const errors = result.issues.filter((entry) => entry.severity === "error");
  if (errors.length > 0) {
    throw new Error(
      `Simulation invariant failure: ${errors.map((e) => e.message).join(" | ")}`,
    );
  }
}
