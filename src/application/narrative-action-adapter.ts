import { asSponsorshipId, type NarrativeSituationId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  acknowledgeSituation,
  findOpenSituation,
  resolveSituation,
} from "@/systems/narrative/lifecycle";
import { setMarketingBudget } from "@/systems/marketing";
import { signSponsorship } from "@/systems/sponsorships";
import { setTicketPrice, TICKET_PRICE_MIN } from "@/systems/ticket-pricing";

export type NarrativeActionTransition =
  | "acknowledge"
  | "take_action"
  | "resolve";

export type NarrativeActionDefinition = {
  transition: NarrativeActionTransition;
  /** When take_action, mutate via existing systems only. */
  run?: (state: GameState, situationId: NarrativeSituationId) => SystemResult;
};

const TICKET_PRICE_REDUCTION = 5;
const MARKETING_BUDGET_BUMP = 500_000;

/**
 * Application catalog: actionId → existing command adapters.
 * Narrative situations never store command strings.
 */
export const NARRATIVE_ACTION_CATALOG: Record<string, NarrativeActionDefinition> =
  {
    review_facilities: { transition: "acknowledge" },
    review_finances: { transition: "acknowledge" },
    open_free_agency: { transition: "acknowledge" },
    stay_the_course: { transition: "acknowledge" },
    reduce_ticket_price: {
      transition: "take_action",
      run: (state) => {
        const teamId = state.user.controlledTeamId;
        const current =
          state.business.franchiseOps[teamId]?.ticketPrice ?? 45;
        const next = Math.max(TICKET_PRICE_MIN, current - TICKET_PRICE_REDUCTION);
        return setTicketPrice(state, teamId, next);
      },
    },
    increase_marketing: {
      transition: "take_action",
      run: (state) => {
        const teamId = state.user.controlledTeamId;
        const current =
          state.business.franchiseOps[teamId]?.marketing.budget ?? 0;
        return setMarketingBudget(
          state,
          teamId,
          current + MARKETING_BUDGET_BUMP,
        );
      },
    },
    accept_sponsor_proposal: {
      transition: "resolve",
      run: (state) => {
        const teamId = state.user.controlledTeamId;
        const year = state.competition.season.year;
        const annualValue = 2_500_000;
        const signed = signSponsorship(state, teamId, {
          id: asSponsorshipId(
            `sponsor_${teamId}_${year}_narrative_extension`,
          ),
          sponsorName: "Regional Partners",
          annualValue,
          startYear: year,
          endYear: year + 2,
          reputationFloor: 40,
          playoffBonus: Math.round(annualValue * 0.1),
        });
        return signed;
      },
    },
    decline_sponsor_proposal: { transition: "resolve" },
  };

export function getNarrativeActionDefinition(
  actionId: string,
): NarrativeActionDefinition {
  const definition = NARRATIVE_ACTION_CATALOG[actionId];
  if (!definition) {
    throw new Error(`Unknown narrative actionId "${actionId}".`);
  }
  return definition;
}

/**
 * Apply a narrative action: run existing systems (if any), then lifecycle transition.
 */
export function applyNarrativeAction(
  state: GameState,
  situationId: NarrativeSituationId,
  actionId: string,
): SystemResult {
  const definition = getNarrativeActionDefinition(actionId);
  const situation = state.user.narrative.situations.find(
    (entry) => entry.id === situationId,
  );
  if (!situation) {
    throw new Error(`Narrative situation "${situationId}" not found.`);
  }
  if (
    situation.status === "resolved" ||
    situation.status === "expired"
  ) {
    throw new Error(
      `Narrative situation "${situationId}" is already ${situation.status}.`,
    );
  }

  let current = state;
  const events: SystemResult["events"] = [];

  if (definition.run) {
    const ran = definition.run(current, situationId);
    current = ran.state;
    events.push(...ran.events);
  }

  const date = current.world.calendar.currentDate;
  const situations = current.user.narrative.situations.map((entry) => {
    if (entry.id !== situationId) {
      return entry;
    }
    if (definition.transition === "acknowledge") {
      return acknowledgeSituation(entry, date);
    }
    if (definition.transition === "resolve") {
      return resolveSituation(entry, date);
    }
    // take_action — keep active/acknowledged; do not auto-resolve.
    return {
      ...entry,
      status: entry.status === "escalated" ? "active" : entry.status,
      updatedOn: date,
    };
  });

  return systemResult(
    {
      ...current,
      user: {
        ...current.user,
        narrative: {
          ...current.user.narrative,
          situations,
        },
      },
    },
    events,
  );
}

export function acknowledgeNarrativeSituationInState(
  state: GameState,
  situationId: NarrativeSituationId,
): SystemResult {
  const situation = state.user.narrative.situations.find(
    (entry) => entry.id === situationId,
  );
  if (!situation) {
    throw new Error(`Narrative situation "${situationId}" not found.`);
  }
  const date = state.world.calendar.currentDate;
  return systemResult({
    ...state,
    user: {
      ...state.user,
      narrative: {
        ...state.user.narrative,
        situations: state.user.narrative.situations.map((entry) =>
          entry.id === situationId
            ? acknowledgeSituation(entry, date)
            : entry,
        ),
      },
    },
  });
}

export { findOpenSituation };
