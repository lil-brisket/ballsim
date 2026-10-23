import {
  asContractId,
  asPlayerId,
  asTeamId,
  type PlayerId,
} from "@/domain/ids";
import { type Player, type PlayerPosition } from "@/domain/entities/player";
import { createContract, type Contract } from "@/domain/entities/contract";
import type { Rng } from "@/domain/rng";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import {
  REPLACEMENT_LEVEL_OVERALL,
  salaryForPlayer,
  vetMinSalary,
} from "@/systems/salary-scale";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import {
  FREE_AGENT_CLOSING_ASK_SHARE,
  freeAgentAsk,
} from "@/systems/free-agent-market";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { generatePlayerWithRng } from "@/systems/player-generation";
import {
  DEFAULT_ROSTER_SIZE,
  rosterPositionForSlot,
  rosterQualityBandForSlot,
} from "@/systems/roster-generation-config";
import { recommendRosterManagement } from "@/systems/roster-management";
import { getContractSigningYear, getTeamPayroll } from "@/systems/salary-cap";
import { aiPayrollRoom } from "@/systems/ai-payroll-budget";
import { isUserControlledTeam } from "@/state/owner-context";

/**
 * Fills empty team rosters with fictional players and starter contracts.
 * Idempotent: no-op when any players already exist.
 *
 * Player identity, attributes, potential, and personality come from
 * {@link generatePlayerWithRng}. Contracts and payroll remain roster-owned.
 * Payroll snapshots are derived from contracts after all contracts exist.
 */
export function generateRosters(state: GameState, rng: Rng): SystemResult {
  if (Object.keys(state.world.players).length > 0) {
    return systemResult(state);
  }

  const players: Record<string, Player> = {};
  const contracts: Record<string, Contract> = { ...state.business.contracts };
  const teams: Record<string, (typeof state.world.teams)[string]> = {
    ...state.world.teams,
  };
  const currentYear = state.competition.season.year;

  const teamIds = Object.keys(state.world.teams).sort();

  const occupiedNames = new Set<string>();
  for (const existing of Object.values(state.world.players)) {
    if (existing.retired === true) continue;
    occupiedNames.add(`${existing.firstName} ${existing.lastName}`);
  }

  for (const teamId of teamIds) {
    const rosterPlayerIds: ReturnType<typeof asPlayerId>[] = [];
    for (let slot = 0; slot < DEFAULT_ROSTER_SIZE; slot += 1) {
      const playerId = asPlayerId(`player_${teamId}_${slot}`);
      const position = rosterPositionForSlot(slot);
      const contractId = asContractId(`contract_${playerId}`);

      const player = generatePlayerWithRng(rng, {
        id: playerId,
        teamId: state.world.teams[teamId]!.id,
        contractId,
        position,
        occupiedNames,
        qualityBand: rosterQualityBandForSlot(slot),
      });
      occupiedNames.add(`${player.firstName} ${player.lastName}`);
      players[playerId] = player;
      rosterPlayerIds.push(playerId);

      const salaryPerYear = salaryForPlayer({
        overall: calculatePlayerOverall(player.position, player.attributes),
        age: player.age,
        years: Math.max(0, player.age - 19),
        cap: getLeagueSalaryCap(state),
        kind: "fa",
      });
      const yearsRemaining = rng.nextInt(1, 4);
      const startYear = currentYear;
      const endYear = currentYear + yearsRemaining - 1;
      const salaryByYear: Record<string, number> = {};
      for (let year = startYear; year <= endYear; year += 1) {
        salaryByYear[String(year)] = salaryPerYear;
      }
      contracts[contractId] = createContract({
        id: contractId,
        playerId,
        teamId: state.world.teams[teamId]!.id,
        startYear,
        endYear,
        salaryByYear,
      });
    }
    teams[teamId] = {
      ...teams[teamId]!,
      roster: rosterPlayerIds,
    };
  }

  let stateWithContracts: GameState = {
    ...state,
    world: {
      ...state.world,
      players,
      teams,
    },
    business: {
      ...state.business,
      contracts,
      finances: { ...state.business.finances },
    },
  };

  for (const teamId of teamIds) {
    const management = recommendRosterManagement(
      stateWithContracts,
      asTeamId(teamId),
      { configuredBy: "default" },
    );
    stateWithContracts = {
      ...stateWithContracts,
      world: {
        ...stateWithContracts.world,
        teams: {
          ...stateWithContracts.world.teams,
          [teamId]: {
            ...stateWithContracts.world.teams[teamId]!,
            rosterManagement: management,
          },
        },
      },
    };
  }

  const finances = { ...stateWithContracts.business.finances };
  for (const teamId of teamIds) {
    const existingFinance = finances[teamId];
    if (existingFinance) {
      finances[teamId] = {
        ...existingFinance,
        payroll: getTeamPayroll(
          asTeamId(teamId),
          currentYear,
          stateWithContracts,
        ),
      };
    }
  }

  return systemResult({
    ...stateWithContracts,
    business: {
      ...stateWithContracts.business,
      finances,
    },
  });
}

function takeFillFreeAgent(
  players: Record<string, Player>,
  position: PlayerPosition,
): Player | null {
  const candidates = Object.values(players).filter(
    (player) =>
      player.retired !== true &&
      player.teamId === null &&
      player.contractId == null &&
      player.position === position,
  );
  if (candidates.length === 0) {
    return null;
  }
  candidates.sort((left, right) => {
    const overallLeft = calculatePlayerOverall(left.position, left.attributes);
    const overallRight = calculatePlayerOverall(
      right.position,
      right.attributes,
    );
    if (overallLeft !== overallRight) {
      return overallRight - overallLeft;
    }
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  return candidates[0] ?? null;
}

function nextFillPlayerId(
  teamId: string,
  players: Record<string, Player>,
  startSlot: number,
): { playerId: ReturnType<typeof asPlayerId>; nextSlot: number } {
  let slot = startSlot;
  let playerId = asPlayerId(`player_${teamId}_fill_${slot}`);
  while (players[playerId] !== undefined) {
    slot += 1;
    playerId = asPlayerId(`player_${teamId}_fill_${slot}`);
  }
  return { playerId, nextSlot: slot + 1 };
}

/** A fill comes after free agency, so free agents ask their closing ask. */
function fillMarketSalary(state: GameState, player: Player): number {
  return freeAgentAsk(state, player, FREE_AGENT_CLOSING_ASK_SHARE);
}

/** Last completed season's win%, for waiver order (0.5 with no history). */
function lastSeasonWinPct(state: GameState, teamId: string): number {
  const seasons = state.business.franchiseHistory[teamId]?.seasons ?? [];
  const last = seasons[seasons.length - 1];
  if (!last || last.wins + last.losses === 0) return 0.5;
  return last.wins / (last.wins + last.losses);
}

function isReplacementLevel(player: Player): boolean {
  return (
    calculatePlayerOverall(player.position, player.attributes) <=
    REPLACEMENT_LEVEL_OVERALL
  );
}

/**
 * Adds players so every team reaches {@link DEFAULT_ROSTER_SIZE}.
 * Used after offseason attrition when the free-agent pool cannot fill holes.
 *
 * Each spot goes to the best free agent left at the position. A fill
 * respects the team's room (an AI team's affordable cap space; none for an
 * owner's team): he signs at market when that fits, otherwise for a one-year
 * minimum (the vet-min exception: once free agency is over, an unsigned
 * player takes the minimum), so filling a roster never pushes a team over the
 * cap or its budget with market contracts. Teams fill one spot per round in
 * waiver order (worst last-season record first), so no team gets first call
 * on every leftover.
 */
export function fillShortRosters(state: GameState, rng: Rng): SystemResult {
  const shortTeamIds = (
    Object.keys(state.world.teams) as ReturnType<typeof asTeamId>[]
  )
    .filter(
      (teamId) =>
        (state.world.teams[teamId]?.roster.length ?? 0) < DEFAULT_ROSTER_SIZE,
    )
    .sort(
      (a, b) =>
        lastSeasonWinPct(state, a) - lastSeasonWinPct(state, b) ||
        (a < b ? -1 : a > b ? 1 : 0),
    );
  if (shortTeamIds.length === 0) {
    return systemResult(state);
  }

  const players: Record<string, Player> = { ...state.world.players };
  const contracts: Record<string, Contract> = { ...state.business.contracts };
  const teams: Record<string, (typeof state.world.teams)[string]> = {
    ...state.world.teams,
  };
  const currentYear = getContractSigningYear(state);
  const cap = getLeagueSalaryCap(state);
  const minSalary = vetMinSalary(cap);
  const occupiedNames = new Set<string>();
  for (const existing of Object.values(players)) {
    if (existing.retired === true) continue;
    occupiedNames.add(`${existing.firstName} ${existing.lastName}`);
  }

  type FillProgress = {
    roster: PlayerId[];
    slot: number;
    startPayroll: number;
    payroll: number;
    startRoom: number;
  };
  const progress = new Map<string, FillProgress>();
  for (const teamId of shortTeamIds) {
    const team = teams[teamId]!;
    const startPayroll = getTeamPayroll(teamId, currentYear, state);
    progress.set(teamId, {
      roster: [...team.roster],
      slot: team.roster.length,
      startPayroll,
      payroll: startPayroll,
      // AI teams stay within what they can afford (#93). An owner's roster is
      // only topped up with one-year minimum deals: an automatic fill must not
      // commit the owner to market contracts they never chose.
      startRoom: isUserControlledTeam(state, teamId)
        ? 0
        : aiPayrollRoom(state, teamId, currentYear),
    });
  }

  const fillOne = (teamId: string, fill: FillProgress): void => {
    const team = teams[teamId]!;
    const { roster } = fill;
    const position = rosterPositionForSlot(roster.length);
    const capSpace = fill.startRoom - (fill.payroll - fill.startPayroll);
    const fits = (candidate: Player) =>
      fillMarketSalary(state, candidate) <= capSpace;
    const existing = takeFillFreeAgent(players, position);
    let player: Player;
    if (existing) {
      const contractId = asContractId(
        `contract_fill_${existing.id}_${currentYear}`,
      );
      player = {
        ...existing,
        teamId: team.id,
        contractId,
      };
      players[existing.id] = player;
      roster.push(existing.id);
    } else {
      const next = nextFillPlayerId(teamId, players, fill.slot);
      fill.slot = next.nextSlot;
      const playerId = next.playerId;
      const contractId = asContractId(`contract_${playerId}`);
      const generate = (rosterSlot: number) =>
        generatePlayerWithRng(rng, {
          id: playerId,
          teamId: team.id,
          contractId,
          position,
          occupiedNames,
          qualityBand: rosterQualityBandForSlot(rosterSlot),
        });
      player = generate(roster.length);
      if (!fits(player) && !isReplacementLevel(player)) {
        // No room for this player's market deal: take a bench-level one
        // who will sign for the minimum instead.
        player = generate(DEFAULT_ROSTER_SIZE - 1);
      }
      occupiedNames.add(`${player.firstName} ${player.lastName}`);
      players[playerId] = player;
      roster.push(playerId);
    }

    const contractId = player.contractId!;
    const market = fillMarketSalary(state, player);
    const atMinimum = market > capSpace;
    const salaryPerYear = atMinimum ? minSalary : market;
    // Draw the length either way so the RNG stream does not depend on it.
    const drawnYears = rng.nextInt(1, 4);
    const yearsRemaining = atMinimum ? 1 : drawnYears;
    fill.payroll += salaryPerYear;
    const startYear = currentYear;
    const endYear = currentYear + yearsRemaining - 1;
    const salaryByYear: Record<string, number> = {};
    for (let year = startYear; year <= endYear; year += 1) {
      salaryByYear[String(year)] = salaryPerYear;
    }
    contracts[contractId] = createContract({
      id: contractId,
      playerId: player.id,
      teamId: team.id,
      startYear,
      endYear,
      salaryByYear,
    });
  };

  let filling = true;
  while (filling) {
    filling = false;
    for (const teamId of shortTeamIds) {
      const fill = progress.get(teamId)!;
      if (fill.roster.length >= DEFAULT_ROSTER_SIZE) continue;
      fillOne(teamId, fill);
      filling = true;
    }
  }
  for (const teamId of shortTeamIds) {
    teams[teamId] = { ...teams[teamId]!, roster: progress.get(teamId)!.roster };
  }

  let next: GameState = {
    ...state,
    world: {
      ...state.world,
      players,
      teams,
    },
    business: {
      ...state.business,
      contracts,
      finances: { ...state.business.finances },
    },
  };

  for (const teamId of shortTeamIds) {
    const management = recommendRosterManagement(next, teamId, {
      configuredBy: "default",
    });
    next = {
      ...next,
      world: {
        ...next.world,
        teams: {
          ...next.world.teams,
          [teamId]: {
            ...next.world.teams[teamId]!,
            rosterManagement: management,
          },
        },
      },
    };
  }

  const finances = { ...next.business.finances };
  for (const teamId of shortTeamIds) {
    const existingFinance = finances[teamId];
    if (existingFinance) {
      finances[teamId] = {
        ...existingFinance,
        payroll: getTeamPayroll(teamId, currentYear, next),
      };
    }
  }

  return systemResult({
    ...next,
    business: {
      ...next.business,
      finances,
    },
  });
}
