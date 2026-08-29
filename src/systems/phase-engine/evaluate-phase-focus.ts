import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { getActivePhaseId } from "@/systems/phase-engine/resolve-current-phase";
import {
  analyzeTeamPhaseContext,
  type TeamPhaseContext,
} from "@/systems/phase-engine/team-context";
import type {
  LeaguePhaseId,
  PhaseFocus,
} from "@/systems/phase-engine/phase-types";

/**
 * Derive attention themes for the active phase and team.
 * Focus items are not actions — tasks carry the deep links.
 */
export function evaluatePhaseFocus(
  state: GameState,
  teamId: TeamId = state.user.activeOwnerTeamId,
): PhaseFocus[] {
  const phaseId = getActivePhaseId(state);
  const context = analyzeTeamPhaseContext(state, teamId);

  switch (phaseId) {
    case "offseason.roster_decisions":
      return focusRosterDecisions(phaseId, context);
    case "offseason.draft_preparation":
    case "offseason.draft":
      return focusDraft(phaseId, context);
    case "offseason.free_agency":
      return focusFreeAgency(phaseId, context);
    case "offseason.staff_development":
      return focusStaff(phaseId, context);
    case "preseason.preparation":
      return focusPreseason(phaseId, context);
    default:
      return [];
  }
}

function focusRosterDecisions(
  phaseId: LeaguePhaseId,
  context: TeamPhaseContext,
): PhaseFocus[] {
  const items: PhaseFocus[] = [];
  if (context.pendingTeamOptions + context.pendingPlayerOptions > 0) {
    const count =
      context.pendingTeamOptions + context.pendingPlayerOptions;
    items.push({
      focusKey: "pending_options",
      title: `${count} player${count === 1 ? "" : "s"} need decisions`,
      detail: "Unresolved team or player options require a decision.",
      explanation:
        "Options must be exercised or declined before the league can leave Roster Decisions.",
      phaseId,
      teamId: context.teamId,
    });
  }
  if (context.expiringContractCount > 0) {
    items.push({
      focusKey: "expiring_contracts",
      title: `${context.expiringContractCount} expiring contract${context.expiringContractCount === 1 ? "" : "s"}`,
      detail: "Players entering the final year of their deals.",
      explanation:
        "Review extensions and retention before free agency opens after the draft.",
      phaseId,
      teamId: context.teamId,
    });
  }
  if (context.weakestPositions.length > 0) {
    const position = context.weakestPositions[0]!;
    const strength = context.positionalStrengths.find(
      (entry) => entry.position === position,
    );
    items.push({
      focusKey: `weak_position:${position}`,
      title: `Roster needs a stronger ${position}`,
      detail: `Starting ${position} looks like a roster weakness.`,
      explanation: strength
        ? `Your best ${position} is rated ${strength.bestOverall} versus a league positional average of ${strength.leaguePositionalAvg}.`
        : `Your ${position} depth is below league norms.`,
      phaseId,
      teamId: context.teamId,
    });
  }
  return items;
}

function focusDraft(
  phaseId: LeaguePhaseId,
  context: TeamPhaseContext,
): PhaseFocus[] {
  const items: PhaseFocus[] = [];
  if (context.bestDraftPick !== null) {
    items.push({
      focusKey: "draft_pick",
      title: `Pick #${context.bestDraftPick}`,
      detail: "Your earliest remaining draft selection.",
      explanation:
        context.draftPickNumbers.length > 1
          ? `You own ${context.draftPickNumbers.length} remaining picks, starting at #${context.bestDraftPick}.`
          : `You own overall pick #${context.bestDraftPick}.`,
      phaseId,
      teamId: context.teamId,
    });
  } else {
    items.push({
      focusKey: "no_draft_picks",
      title: "No remaining draft picks",
      detail: "Your team has no unused picks in this draft.",
      explanation:
        "You can still scout and explore pick trades, but you are not currently on the clock.",
      phaseId,
      teamId: context.teamId,
    });
  }
  if (context.weakestPositions.length > 0) {
    const position = context.weakestPositions[0]!;
    items.push({
      focusKey: `draft_need:${position}`,
      title: `${position} is a draft priority`,
      detail: "Prospects at this position match a roster need.",
      explanation: `Your roster is weakest at ${position}; prioritize scouting that position.`,
      phaseId,
      teamId: context.teamId,
    });
  }
  return items;
}

function focusFreeAgency(
  phaseId: LeaguePhaseId,
  context: TeamPhaseContext,
): PhaseFocus[] {
  const items: PhaseFocus[] = [];
  const millions = Math.round(context.capSpace / 1_000_000);
  items.push({
    focusKey: "cap_space",
    title:
      context.capSpace >= 0
        ? `$${millions}M available`
        : `$${Math.abs(millions)}M over the cap`,
    detail: "Current player budget relative to the salary cap.",
    explanation:
      context.capSpace >= 0
        ? `You have approximately $${millions}M in cap space to spend on free agents.`
        : `You are over the cap; prioritize cheap depth and creative roster moves.`,
    phaseId,
    teamId: context.teamId,
  });
  if (context.weakestPositions.length > 0) {
    const position = context.weakestPositions[0]!;
    const strength = context.positionalStrengths.find(
      (entry) => entry.position === position,
    );
    items.push({
      focusKey: `fa_need:${position}`,
      title: `Starting ${position} is a priority`,
      detail: "Free agency is the best window to fill this hole.",
      explanation: strength
        ? `Your current starting ${position} is rated ${strength.bestOverall}, below the positional average of ${strength.leaguePositionalAvg}.`
        : `You lack a reliable starter at ${position}.`,
      phaseId,
      teamId: context.teamId,
    });
  }
  return items;
}

function focusStaff(
  phaseId: LeaguePhaseId,
  context: TeamPhaseContext,
): PhaseFocus[] {
  const items: PhaseFocus[] = [];
  if (context.vacantStaffRoles.length > 0) {
    items.push({
      focusKey: "staff_vacancies",
      title: `${context.vacantStaffRoles.length} staff vacanc${context.vacantStaffRoles.length === 1 ? "y" : "ies"}`,
      detail: context.vacantStaffRoles.map(formatRole).join(", "),
      explanation:
        "Empty starter staff roles reduce development quality and scouting coverage.",
      phaseId,
      teamId: context.teamId,
    });
  } else {
    items.push({
      focusKey: "staff_stable",
      title: "Staff is fully staffed",
      detail: "All starter front-office and coaching roles are filled.",
      explanation:
        "You can still upgrade roles or adjust development priorities.",
      phaseId,
      teamId: context.teamId,
    });
  }
  return items;
}

function focusPreseason(
  phaseId: LeaguePhaseId,
  context: TeamPhaseContext,
): PhaseFocus[] {
  return [
    {
      focusKey: "preseason_prep",
      title: "Finalize roster and rotations",
      detail: `Roster size: ${context.rosterSize} players.`,
      explanation:
        "Set depth charts, rotations, and lineups before the regular season begins.",
      phaseId,
      teamId: context.teamId,
    },
  ];
}

function formatRole(role: string): string {
  return role.replaceAll("_", " ");
}
