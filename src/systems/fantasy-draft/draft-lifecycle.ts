import { createDomainEvent, type DomainEvent } from "@/domain/events/domain-event";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import { analyzeFantasyDraft } from "@/systems/fantasy-draft/draft-analysis";
import { withFantasyDraft } from "@/systems/fantasy-draft/draft-order";
import { FANTASY_DRAFT_PICKS_PER_TEAM } from "@/systems/fantasy-draft/fantasy-draft-config";
import { reconcileRosterManagement } from "@/systems/roster-management";
import { getTeamPayroll } from "@/systems/salary-cap";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";

export type FantasyDraftCompleteResult = {
  state: GameState;
  events: DomainEvent[];
};

/**
 * Finalizes the fantasy draft:
 * - Marks complete, clears currentPickNumber
 * - Runs data-driven post-draft analysis
 * - Undrafted pool players remain teamId/contractId null → free agents
 * - Reconciles roster management for all teams once
 * - Validates roster sizes and payroll snapshots
 */
export function completeFantasyDraft(
  state: GameState,
): FantasyDraftCompleteResult {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    throw new Error("No fantasy draft exists.");
  }
  if (draft.selections.length !== draft.totalPicks) {
    throw new Error(
      `Cannot complete fantasy draft: ${draft.selections.length}/${draft.totalPicks} picks made.`,
    );
  }

  const analysis = analyzeFantasyDraft(state);

  let next = withFantasyDraft(state, {
    ...draft,
    status: "complete",
    currentPickNumber: null,
    pausedAt: null,
    timer: {
      ...draft.timer,
      pickStartedAt: null,
    },
    pickAnalyses: analysis.pickAnalyses,
    teamSummaries: analysis.teamSummaries,
    leagueRecap: analysis.leagueRecap,
  });

  const seasonYear = next.competition.season.year;
  const teamIds = Object.keys(next.world.teams);

  for (const teamId of teamIds) {
    const team = next.world.teams[teamId]!;
    if (team.roster.length !== FANTASY_DRAFT_PICKS_PER_TEAM) {
      throw new Error(
        `Team "${teamId}" has ${team.roster.length} players; expected ${FANTASY_DRAFT_PICKS_PER_TEAM}.`,
      );
    }
    if (team.roster.length > TRADE_ROSTER_RULES.maxRosterSize) {
      throw new Error(
        `Team "${teamId}" exceeds max roster size after fantasy draft.`,
      );
    }
    next = reconcileRosterManagement(next, team.id);
    const finance = next.business.finances[teamId];
    if (finance) {
      next = {
        ...next,
        business: {
          ...next.business,
          finances: {
            ...next.business.finances,
            [teamId]: {
              ...finance,
              payroll: getTeamPayroll(team.id, seasonYear, next),
            },
          },
        },
      };
    }
  }

  const seen = new Set<string>();
  for (const team of Object.values(next.world.teams)) {
    for (const playerId of team.roster) {
      if (seen.has(String(playerId))) {
        throw new Error(
          `Duplicate player "${playerId}" across fantasy draft rosters.`,
        );
      }
      seen.add(String(playerId));
    }
  }

  const events: DomainEvent[] = [
    createDomainEvent({
      type: "OffseasonStageAdvanced",
      occurredOn: next.world.calendar.currentDate,
      payload: {
        stage: "fantasy_draft_complete",
        totalPicks: draft.totalPicks,
        undraftedCount:
          draft.poolPlayerIds.length - draft.selectedPlayerIds.length,
      },
    }),
  ];

  next = appendSeasonEventLog(next, events);

  return { state: next, events };
}
