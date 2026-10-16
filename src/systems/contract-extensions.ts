/**
 * CPU contract extensions during offseason roster decisions.
 * Rewrites remaining years of underpaid star deals to market salary.
 */

import {
  createContract,
  getContractSalaryForYear,
} from "@/domain/entities/contract";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { getContractSigningYear, getTeamCapSpace } from "@/systems/salary-cap";
import { salaryForPlayer, serviceYearsForSalary } from "@/systems/salary-scale";

const EXTENSION_OVERALL_FLOOR = 80;
const UNDERPAID_RATIO = 1.2;
const MAX_ADDED_YEARS = 2;

export function processCpuContractExtensions(state: GameState): SystemResult {
  // Runs in the offseason: rewrite from the season the extension first covers,
  // not the completed one, and check cap space against that season.
  const year = getContractSigningYear(state);
  const cap = getLeagueSalaryCap(state);
  let current = state;
  const events: DomainEvent[] = [];

  for (const team of Object.values(current.world.teams)) {
    const result = extendTeamStars(current, team.id, year, cap);
    current = result.state;
    events.push(...result.events);
  }

  return systemResult(current, events);
}

function extendTeamStars(
  state: GameState,
  teamId: TeamId,
  year: number,
  cap: number,
): SystemResult {
  const team = state.world.teams[teamId];
  if (!team) return systemResult(state);

  let current = state;
  const events: DomainEvent[] = [];

  for (const playerId of team.roster) {
    const player = current.world.players[playerId];
    if (!player || player.retired || player.contractId == null) continue;
    const overall = calculatePlayerOverall(player.position, player.attributes);
    if (overall < EXTENSION_OVERALL_FLOOR) continue;

    const contract = current.business.contracts[player.contractId];
    if (!contract || contract.teamId !== teamId) continue;

    const nextSalary = getContractSalaryForYear(contract, year);
    const currentSalary =
      nextSalary ?? getContractSalaryForYear(contract, year - 1) ?? 0;
    const market = salaryForPlayer({
      overall,
      age: player.age,
      years: serviceYearsForSalary({
        age: player.age,
        seasonYear: current.competition.season.year,
        draftSeasonYear: player.developmentLeague?.draftSeasonYear ?? null,
        seasonsPlayed:
          current.business.playerHistory[playerId]?.seasons.length ?? 0,
      }),
      cap,
      kind: "fa",
    });
    if (market < currentSalary * UNDERPAID_RATIO) continue;

    const remainingYears = Math.max(0, contract.endYear - year + 1);
    const extraYears = remainingYears <= 1 ? MAX_ADDED_YEARS : 0;
    const endYear = contract.endYear + extraYears;
    const raise = market - (nextSalary ?? 0);
    const space = getTeamCapSpace(teamId, year, current, cap);
    if (raise > 0 && space < raise) continue;

    const salaryByYear = { ...contract.salaryByYear };
    for (let seasonYear = year; seasonYear <= endYear; seasonYear += 1) {
      salaryByYear[String(seasonYear)] = market;
    }
    const nextContract = createContract({
      ...contract,
      endYear,
      salaryByYear,
    });
    current = {
      ...current,
      business: {
        ...current.business,
        contracts: {
          ...current.business.contracts,
          [nextContract.id]: nextContract,
        },
      },
    };
    events.push(
      createDomainEvent({
        type: "ContractSigned",
        occurredOn: current.world.calendar.currentDate,
        payload: {
          playerId,
          teamId,
          contractId: nextContract.id,
          annualSalary: market,
          endYear,
          reason: "extension",
        },
      }),
    );
  }

  return systemResult(current, events);
}
