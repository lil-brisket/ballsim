import "server-only";
import { withReadyReset } from "@/systems/participation";
import { prepareSharedAdvance } from "@/application/game-service/shared-advance";
import type { SaveGameStore } from "@/persistence/save-game-store";
import { getActionBlockReason } from "@/systems/league-rules";
import { asPlayerId, asOfferId, asContractId } from "@/domain/ids";
import {
  listFreeAgents,
  makeOffer,
  acceptOffer,
  validateOfferAcceptable,
  withdrawOffer,
} from "@/systems/free-agency";
import {
  type ContractInput,
  exerciseTeamOption,
  declineTeamOption,
} from "@/domain/entities/contract";
import { createSeededRng } from "@/domain/rng";
import { recordOwnershipEvidence } from "@/systems/ownership-confidence-engine";
import { scoreFreeAgentSigning } from "@/systems/ownership-alignment-signals";
import {
  withTimeAdvanceDedupe,
  mapTimeAdvancePersistenceError,
} from "@/application/time-advance-mutation";
import { isInLeaguePhase } from "@/systems/phase-engine";
import { getContractSigningYear } from "@/systems/salary-cap";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { salaryBoundsBlockReason } from "@/systems/salary-scale";
import { advanceLeaguePhase } from "@/systems/simulation/offseason-lifecycle";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { isUserOnDraftClock } from "@/systems/draft";
import { processDerivedProjections } from "@/systems/media-hub";
import {
  declineRfaOfferSheet,
  getOfferSheetBlockReason,
  issueQualifyingOffer,
  matchRfaOfferSheet,
  offerSheetTerms,
  submitRfaOfferSheet,
} from "@/systems/rfa";
import {
  getExtensionBlockReason,
  offerContractExtension,
} from "@/systems/contract-extensions";
import {
  getPlayerReleaseBlockReason,
  releasePlayerUnderContract,
  type ReleaseMode,
} from "@/systems/player-release";
import type { GameState } from "@/state/game-state";
import type { OwnerCommandResult } from "@/application/game-service/types";
import {
  getStore,
  fail,
  persistWorkingState,
  withDashboard,
} from "@/application/game-service/internal";

export async function signOwnerFreeAgent(
  saveId: string,
  input: { playerId: string; salary?: number; years?: number },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }

  const state = loaded.state;
  const faBlock = getActionBlockReason(state, {
    kind: "sign_free_agent",
    playerId: asPlayerId(input.playerId),
    teamId: state.user.activeOwnerTeamId,
  });
  if (faBlock) {
    return fail(faBlock);
  }

  const playerId = asPlayerId(input.playerId);
  const teamId = state.user.activeOwnerTeamId;
  const year = getContractSigningYear(state);
  const pool = listFreeAgents(state);
  if (!pool.playerIds.includes(playerId)) {
    return fail("Player is not an available free agent.");
  }

  const salary = input.salary ?? 2_000_000;
  const years = input.years ?? 1;
  if (!Number.isInteger(years) || years < 1) {
    return fail("Contract years must be an integer >= 1.");
  }
  const salaryBlock = salaryBoundsBlockReason(
    getLeagueSalaryCap(state),
    salary,
  );
  if (salaryBlock) {
    return fail(salaryBlock);
  }

  const endYear = year + years - 1;
  const salaryByYear: Record<string, number> = {};
  for (let y = year; y <= endYear; y += 1) {
    salaryByYear[String(y)] = salary;
  }

  const offerId = asOfferId(
    `offer_owner_${teamId}_${playerId}_${state.world.calendar.currentDate}`,
  );
  const contractId = asContractId(`contract_owner_${playerId}_${year}`);
  const terms: ContractInput = {
    id: contractId,
    playerId,
    teamId,
    startYear: year,
    endYear,
    salaryByYear,
  };

  const rng = createSeededRng(state.meta.rngState);
  try {
    const offered = makeOffer(state, {
      id: offerId,
      playerId,
      teamId,
      terms,
    });
    const stale = validateOfferAcceptable(offered.state, offerId);
    if (stale !== null) {
      return fail(stale);
    }
    const accepted = acceptOffer(offered.state, offerId);
    // A signing is answered on the spot: if he turns it down, nothing is saved.
    if (accepted.state.world.players[playerId]?.teamId !== teamId) {
      const player = state.world.players[playerId];
      const name = player ? `${player.firstName} ${player.lastName}` : "He";
      return fail(`${name} turned down the offer.`);
    }
    const withEvidence = recordOwnershipEvidence(
      accepted.state,
      scoreFreeAgentSigning(state, playerId, salary, years),
    );
    const saved = await persistWorkingState(
      saveId,
      withEvidence,
      rng.getState(),
      saveStore,
      [...offered.events, ...accepted.events],
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function finishFreeAgency(
  saveId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  try {
    return await withTimeAdvanceDedupe(saveId, async () => {
      const saveStore = getStore(store);
      const loaded = await saveStore.load(saveId);
      if (!loaded) {
        return fail("Save not found.");
      }

      if (!isInLeaguePhase(loaded.state, "offseason.free_agency")) {
        return fail("Finish free agency requires offseason free_agency stage.");
      }
      const gate = prepareSharedAdvance(loaded.state);
      if (!gate.ok) {
        return fail(gate.error);
      }
      const prepared = gate.state;

      const commitToken = loaded.updatedAt;
      const rng = createSeededRng(prepared.meta.rngState);
      const advanced = advanceLeaguePhase(prepared, rng);
      let working = advanced.state;
      const emitted = [...advanced.events];
      const dayResult = advanceSimulation(working, rng, { days: 1 });
      working = dayResult.state;
      emitted.push(...dayResult.events);

      if (isUserOnDraftClock(working)) {
        // Persist stopped at draft clock without requiring another advance.
      }

      working = withReadyReset(processDerivedProjections(working, emitted));

      const saved = await persistWorkingState(
        saveId,
        working,
        rng.getState(),
        saveStore,
        emitted,
        { ifUpdatedAt: commitToken },
      );
      return withDashboard(saved);
    });
  } catch (error) {
    return fail(mapTimeAdvancePersistenceError(error));
  }
}

export async function makeOwnerFreeAgentOffer(
  saveId: string,
  input: { playerId: string; salary?: number; years?: number },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const state = loaded.state;
  if (!isInLeaguePhase(state, "offseason.free_agency")) {
    return fail(
      "Free agent offers are only allowed during offseason free agency.",
    );
  }
  const playerId = asPlayerId(input.playerId);
  const teamId = state.user.activeOwnerTeamId;
  const year = getContractSigningYear(state);
  if (!listFreeAgents(state).playerIds.includes(playerId)) {
    return fail("Player is not an available free agent.");
  }
  const salary = input.salary ?? 2_000_000;
  const years = input.years ?? 1;
  if (!Number.isInteger(years) || years < 1) {
    return fail("Contract years must be an integer >= 1.");
  }
  const salaryBlock = salaryBoundsBlockReason(
    getLeagueSalaryCap(state),
    salary,
  );
  if (salaryBlock) {
    return fail(salaryBlock);
  }
  const endYear = year + years - 1;
  const salaryByYear: Record<string, number> = {};
  for (let y = year; y <= endYear; y += 1) {
    salaryByYear[String(y)] = salary;
  }
  const offerId = asOfferId(
    `offer_owner_${teamId}_${playerId}_${state.world.calendar.currentDate}_${crypto.randomUUID()}`,
  );
  const contractId = asContractId(
    `contract_owner_${playerId}_${year}_${crypto.randomUUID()}`,
  );
  const terms: ContractInput = {
    id: contractId,
    playerId,
    teamId,
    startYear: year,
    endYear,
    salaryByYear,
  };
  const rng = createSeededRng(state.meta.rngState);
  try {
    const offered = makeOffer(state, { id: offerId, playerId, teamId, terms });
    const saved = await persistWorkingState(
      saveId,
      offered.state,
      rng.getState(),
      saveStore,
      offered.events,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function withdrawOwnerFreeAgentOffer(
  saveId: string,
  offerId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const typedOfferId = asOfferId(offerId);
  const offer = loaded.state.business.freeAgency.offers[typedOfferId];
  if (!offer) {
    return fail("Offer not found.");
  }
  if (offer.teamId !== loaded.state.user.activeOwnerTeamId) {
    return fail("Offer does not belong to your team.");
  }
  const rng = createSeededRng(loaded.state.meta.rngState);
  try {
    const withdrawn = withdrawOffer(loaded.state, typedOfferId);
    const saved = await persistWorkingState(
      saveId,
      withdrawn.state,
      rng.getState(),
      saveStore,
      withdrawn.events,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

export async function exerciseOwnerTeamOption(
  saveId: string,
  contractId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return applyOwnerContractOption(saveId, contractId, "exercise", store);
}

export async function declineOwnerTeamOption(
  saveId: string,
  contractId: string,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  return applyOwnerContractOption(saveId, contractId, "decline", store);
}

async function applyOwnerContractOption(
  saveId: string,
  contractId: string,
  action: "exercise" | "decline",
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const typedId = asContractId(contractId);
  const contract = loaded.state.business.contracts[typedId];
  if (!contract) {
    return fail("Contract not found.");
  }
  if (contract.teamId !== loaded.state.user.activeOwnerTeamId) {
    return fail("Contract does not belong to your team.");
  }
  if (contract.teamOption?.status !== "pending") {
    return fail("Contract has no pending team option.");
  }
  try {
    const nextContract =
      action === "exercise"
        ? exerciseTeamOption(contract)
        : declineTeamOption(contract);
    const working: GameState = {
      ...loaded.state,
      business: {
        ...loaded.state.business,
        contracts: {
          ...loaded.state.business.contracts,
          [typedId]: nextContract,
        },
      },
    };
    const saved = await persistWorkingState(
      saveId,
      working,
      loaded.state.meta.rngState,
      saveStore,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/** Waive or buy out one of the active owner team's players. */
export async function releaseOwnerPlayer(
  saveId: string,
  input: { playerId: string; mode: ReleaseMode },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  if (input.mode !== "waive" && input.mode !== "buyout") {
    return fail("Unknown release type.");
  }
  const state = loaded.state;
  const playerId = asPlayerId(input.playerId);
  const teamId = state.user.activeOwnerTeamId;
  const ruleBlock = getActionBlockReason(state, {
    kind: "player_release",
    playerId,
    teamId,
  });
  if (ruleBlock) {
    return fail(ruleBlock);
  }
  const blocked = getPlayerReleaseBlockReason(state, { playerId, teamId });
  if (blocked) {
    return fail(blocked);
  }
  try {
    const released = releasePlayerUnderContract(state, {
      playerId,
      teamId,
      mode: input.mode,
    });
    const saved = await persistWorkingState(
      saveId,
      released.state,
      state.meta.rngState,
      saveStore,
      released.events,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/** Offer one of the active owner team's players an extension. */
export async function offerOwnerContractExtension(
  saveId: string,
  input: { playerId: string; years: number; salary: number },
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const state = loaded.state;
  const playerId = asPlayerId(input.playerId);
  const teamId = state.user.activeOwnerTeamId;
  const terms = { years: input.years, salary: input.salary };
  const ruleBlock = getActionBlockReason(state, {
    kind: "contract_extension",
    playerId,
    teamId,
  });
  if (ruleBlock) {
    return fail(ruleBlock);
  }
  const blocked = getExtensionBlockReason(state, { playerId, teamId, terms });
  if (blocked) {
    return fail(blocked);
  }
  try {
    const { result } = offerContractExtension(state, {
      playerId,
      teamId,
      terms,
    });
    const saved = await persistWorkingState(
      saveId,
      result.state,
      state.meta.rngState,
      saveStore,
      result.events,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

type RfaCommand =
  | { kind: "issue_qo"; playerId: string }
  | { kind: "match"; playerId: string }
  | { kind: "decline"; playerId: string }
  | { kind: "offer_sheet"; playerId: string; salary: number; years: number };

/**
 * Restricted free agency for the active owner team: issue a qualifying
 * offer, match or decline a sheet for one of your players, or submit a
 * sheet to another team's restricted free agent.
 */
export async function runOwnerRfaCommand(
  saveId: string,
  command: RfaCommand,
  store?: SaveGameStore,
): Promise<OwnerCommandResult> {
  const saveStore = getStore(store);
  const loaded = await saveStore.load(saveId);
  if (!loaded) {
    return fail("Save not found.");
  }
  const state = loaded.state;
  const playerId = asPlayerId(command.playerId);
  const teamId = state.user.activeOwnerTeamId;
  const sheetInput =
    command.kind === "offer_sheet"
      ? {
          playerId,
          offeringTeamId: teamId,
          salary: command.salary,
          years: command.years,
          contractId: `contract_owner_sheet_${playerId}_${state.world.calendar.currentDate.replaceAll("-", "")}`,
        }
      : null;
  const ruleBlock = getActionBlockReason(
    state,
    command.kind === "issue_qo"
      ? { kind: "issue_rfa_qualifying_offer", playerId, teamId }
      : command.kind === "match"
        ? { kind: "match_rfa_offer", playerId, teamId }
        : command.kind === "decline"
          ? { kind: "decline_rfa_match", playerId, teamId }
          : {
              kind: "submit_rfa_offer_sheet",
              playerId,
              offeringTeamId: teamId,
              terms: offerSheetTerms(state, sheetInput!),
            },
  );
  if (ruleBlock) {
    return fail(ruleBlock);
  }
  try {
    let result;
    if (command.kind === "issue_qo") {
      result = issueQualifyingOffer(state, playerId);
    } else if (command.kind === "match") {
      result = matchRfaOfferSheet(state, playerId, teamId);
    } else if (command.kind === "decline") {
      result = declineRfaOfferSheet(state, playerId, teamId);
    } else {
      const input = sheetInput!;
      const blocked = getOfferSheetBlockReason(state, input);
      if (blocked) {
        return fail(blocked);
      }
      const sheet = submitRfaOfferSheet(state, input);
      if (!sheet.signed) {
        return fail("He turned down the offer sheet. Offer more money.");
      }
      result = sheet.result;
    }
    const saved = await persistWorkingState(
      saveId,
      result.state,
      state.meta.rngState,
      saveStore,
      result.events,
    );
    return withDashboard(saved);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}
