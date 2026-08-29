import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  evaluatePhaseFocus,
  evaluatePhaseTasks,
  evaluatePhaseTasksForOwnedTeams,
  getPhaseDefinition,
  previewAdvance,
  resolveCurrentPhase,
  type PhaseAdvancePreview,
  type PhaseAttentionSummary,
  type PhaseFocus,
  type PhaseTask,
  type ResolvedPhase,
} from "@/systems/phase-engine";

export type PhaseTeamAttentionView = {
  teamId: TeamId;
  teamLabel: string;
  requiredCount: number;
  recommendedCount: number;
  optionalCount: number;
  isActive: boolean;
};

export type PhaseDashboardView = {
  resolved: ResolvedPhase;
  focus: PhaseFocus[];
  attention: PhaseAttentionSummary;
  preview: PhaseAdvancePreview;
  nowLabel: string;
  nextLabel: string | null;
  laterLabel: string | null;
  priorityLine: string | null;
  canAdvance: boolean;
  showAdvanceControl: boolean;
  ownedTeams: PhaseTeamAttentionView[];
  optionalLinks: Array<{ label: string; href: string }>;
};

/**
 * Build the phase command-center view for the dashboard top layer.
 */
export function toPhaseDashboardView(
  state: GameState,
  teamId: TeamId = state.user.activeOwnerTeamId,
): PhaseDashboardView {
  const resolved = resolveCurrentPhase(state);
  const focus = evaluatePhaseFocus(state, teamId);
  const attention = evaluatePhaseTasks(state, teamId);
  const preview = previewAdvance(state);
  const saveId = state.meta.saveId;

  const ownedSummaries = evaluatePhaseTasksForOwnedTeams(state);
  const ownedTeams: PhaseTeamAttentionView[] = state.user.ownedTeamIds.map(
    (id) => {
      const team = state.world.teams[id];
      const summary = ownedSummaries[id] ?? {
        required: [],
        recommended: [],
        optional: [],
        counts: { required: 0, recommended: 0, optional: 0 },
      };
      return {
        teamId: id,
        teamLabel: team ? `${team.city} ${team.name}` : id,
        requiredCount: summary.counts.required,
        recommendedCount: summary.counts.recommended,
        optionalCount: summary.counts.optional,
        isActive: id === teamId,
      };
    },
  );

  const priorityLine =
    attention.required[0]?.title ??
    attention.recommended[0]?.title ??
    focus[0]?.title ??
    null;

  const def = getPhaseDefinition(resolved.phaseId);
  const showAdvanceControl =
    def.advanceMode === "user" &&
    resolved.nextPhaseId !== null &&
    resolved.phaseId !== "postseason.season_review";

  return {
    resolved,
    focus,
    attention,
    preview,
    nowLabel: resolved.name,
    nextLabel: resolved.nextPhaseName,
    laterLabel: resolved.laterPhaseName,
    priorityLine,
    canAdvance: preview.canAdvance,
    showAdvanceControl,
    ownedTeams,
    optionalLinks: buildOptionalLinks(saveId, resolved.phaseId),
  };
}

function buildOptionalLinks(
  saveId: string,
  phaseId: string,
): Array<{ label: string; href: string }> {
  const base = `/dashboard/${saveId}`;
  const links: Array<{ label: string; href: string }> = [
    { label: "Roster", href: `${base}/roster` },
    { label: "Contracts", href: `${base}/contracts` },
    { label: "Trades", href: `${base}/team-management/transactions` },
    { label: "Staff", href: `${base}/staff` },
  ];
  if (
    phaseId === "offseason.draft" ||
    phaseId === "offseason.draft_preparation"
  ) {
    links.unshift({ label: "Draft", href: `${base}/draft` });
  }
  if (phaseId === "offseason.free_agency") {
    links.unshift({ label: "Free Agency", href: `${base}/free-agency` });
  }
  return links;
}

export type { PhaseTask, PhaseFocus, PhaseAttentionSummary, PhaseAdvancePreview };
