import { createEmptyPlayoffTournament } from "@/domain/entities/playoffs";
import { createEmptyTeamStanding } from "@/domain/entities/standings";
import type { OffseasonStage } from "@/domain/entities/season";
import { draftClassIdFor } from "@/domain/entities/draft";
import { mergeDraftPicksForSeason } from "@/domain/draft-picks/generate-draft-picks";
import type { DomainEvent } from "@/domain/events";
import { asSeasonId, type TeamId } from "@/domain/ids";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  activateDraft,
  completeDraft,
  createDraft,
  draftYearForSeason,
} from "@/systems/draft";
import { releaseExpiredContracts } from "@/systems/free-agency";
import { appendAllFranchiseSeasonRecords } from "@/systems/franchise-history";
import { processSeasonalLeagueEconomy } from "@/systems/league-economy";
import { tickRelocationCooldowns } from "@/systems/relocation";
import { processSeasonPlayerDevelopment } from "@/systems/season-player-development";
import { expireSponsorshipsAtSeason } from "@/systems/sponsorships";
import { transitionPhase } from "@/systems/simulation/phase-machine";

function setOffseasonStage(
  state: GameState,
  offseasonStage: OffseasonStage,
): GameState {
  if (state.competition.season.offseasonStage === offseasonStage) {
    return state;
  }
  return {
    ...state,
    competition: {
      ...state.competition,
      season: {
        ...state.competition.season,
        offseasonStage,
      },
    },
  };
}

/**
 * Explicit exit from a persistent offseason activity period (e.g. free_agency → draft).
 * Immediate stages are advanced by processOffseasonLifecycle, not this helper.
 */
export function advanceOffseasonStage(state: GameState): SystemResult {
  if (state.competition.season.phase !== "offseason") {
    throw new Error(
      `advanceOffseasonStage requires phase "offseason"; got "${state.competition.season.phase}".`,
    );
  }

  const stage = state.competition.season.offseasonStage;
  if (stage === "free_agency") {
    return systemResult(setOffseasonStage(state, "draft"));
  }

  throw new Error(
    `advanceOffseasonStage cannot advance from offseason stage "${stage}".`,
  );
}

function withEnsuredDraftPicks(state: GameState): GameState {
  const teams = Object.values(state.world.teams);
  const draftPicks = mergeDraftPicksForSeason(
    state.world.draftPicks,
    teams,
    state.competition.season.year,
  );
  if (draftPicks === state.world.draftPicks) {
    return state;
  }
  return {
    ...state,
    world: {
      ...state.world,
      draftPicks,
    },
  };
}

/**
 * Atomic new-season initialization: year/id/competition reset/picks/preseason
 * in a single SystemResult. No player aging.
 */
export function initializeNewSeason(state: GameState): SystemResult {
  if (state.competition.season.phase !== "offseason") {
    throw new Error(
      `initializeNewSeason requires phase "offseason"; got "${state.competition.season.phase}".`,
    );
  }
  if (state.competition.season.offseasonStage !== "league_initialization") {
    throw new Error(
      `initializeNewSeason requires offseasonStage "league_initialization"; got "${state.competition.season.offseasonStage}".`,
    );
  }

  const nextYear = state.competition.season.year + 1;
  const nextSeasonId = asSeasonId(`season_${nextYear}`);

  const standingsByTeamId: Record<
    string,
    ReturnType<typeof createEmptyTeamStanding>
  > = {};
  for (const teamId of Object.keys(state.world.teams).sort() as TeamId[]) {
    standingsByTeamId[teamId] = createEmptyTeamStanding(teamId);
  }

  let next: GameState = {
    ...state,
    competition: {
      season: {
        id: nextSeasonId,
        year: nextYear,
        phase: "offseason",
        offseasonStage: "none",
        regularSeasonStartDate: null,
      },
      schedule: {
        seasonId: nextSeasonId,
        gameIds: [],
      },
      games: {},
      standings: { byTeamId: standingsByTeamId },
      playoffs: createEmptyPlayoffTournament(),
    },
  };

  next = withEnsuredDraftPicks(next);

  const phaseResult = transitionPhase(next, "preseason");
  return systemResult(phaseResult.state, phaseResult.events);
}

function isDraftOrderFullyUsed(state: GameState, draftClassId: string): boolean {
  const draft = state.world.drafts[draftClassId];
  if (draft === undefined || draft.order.length === 0) {
    return false;
  }
  return draft.order.every((slot) => slot.status === "used");
}

/**
 * Stateful offseason stage evaluation.
 * Immediate stages may chain in one call; free_agency and draft persist.
 * When every draft order slot is used, auto-completes the draft then
 * advances to league_initialization → new season.
 */
export function processOffseasonLifecycle(
  state: GameState,
  rng: Rng,
): SystemResult {
  if (state.competition.season.phase !== "offseason") {
    return systemResult(state);
  }

  const events: DomainEvent[] = [];
  let current = state;

  if (current.competition.season.offseasonStage === "season_finalization") {
    const history = appendAllFranchiseSeasonRecords(current);
    current = history.state;
    events.push(...history.events);

    const development = processSeasonPlayerDevelopment(current, rng);
    current = development.state;
    events.push(...development.events);

    const sponsorships = expireSponsorshipsAtSeason(current);
    current = sponsorships.state;
    events.push(...sponsorships.events);

    const economy = processSeasonalLeagueEconomy(current);
    current = economy.state;
    events.push(...economy.events);

    const relocation = tickRelocationCooldowns(current);
    current = relocation.state;
    events.push(...relocation.events);

    current = setOffseasonStage(current, "contract_expiration");
  }

  if (current.competition.season.offseasonStage === "contract_expiration") {
    const released = releaseExpiredContracts(current);
    current = released.state;
    events.push(...released.events);
    current = setOffseasonStage(current, "free_agency");
  }

  if (current.competition.season.offseasonStage === "draft") {
    const draftYear = draftYearForSeason(current.competition.season.year);
    const draftClassId = draftClassIdFor(draftYear);
    let draft = current.world.drafts[draftClassId];

    if (draft === undefined) {
      const created = createDraft(current, rng);
      current = created.state;
      events.push(...created.events);
      draft = current.world.drafts[draftClassId];
    }

    if (draft !== undefined && draft.status === "not_started") {
      const activated = activateDraft(current, draftClassId);
      current = activated.state;
      events.push(...activated.events);
      draft = current.world.drafts[draftClassId];
    }

    if (
      draft !== undefined &&
      draft.status === "active" &&
      isDraftOrderFullyUsed(current, draftClassId)
    ) {
      const completed = completeDraft(current, draftClassId);
      current = completed.state;
      events.push(...completed.events);
      draft = current.world.drafts[draftClassId];
    }

    if (draft !== undefined && draft.status === "complete") {
      current = setOffseasonStage(current, "league_initialization");
    }
  }

  if (current.competition.season.offseasonStage === "league_initialization") {
    const initialized = initializeNewSeason(current);
    current = initialized.state;
    events.push(...initialized.events);
  }

  return systemResult(current, events);
}
