/**
 * Deterministic headline + summary generation from DomainEvent + GameState.
 * Same event + state MUST produce the same headline.
 */

import type { DomainEvent } from "@/domain/events";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";

function teamName(state: GameState, teamId: string | undefined): string {
  if (!teamId) {
    return "Unknown Team";
  }
  const team = state.world.teams[teamId];
  if (!team) {
    return "Unknown Team";
  }
  return `${team.city} ${team.name}`;
}

function playerName(state: GameState, playerId: string | undefined): string {
  if (!playerId) {
    return "Unknown Player";
  }
  const player = state.world.players[playerId];
  if (!player) {
    return "Unknown Player";
  }
  return `${player.firstName} ${player.lastName}`;
}

function str(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(payload: Record<string, unknown>, key: string): number | undefined {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export type GeneratedHeadline = {
  headline: string;
  summary: string;
};

/**
 * Build a deterministic headline and summary for a domain event.
 */
export function generateHeadline(
  event: DomainEvent,
  state: GameState,
): GeneratedHeadline {
  const p = event.payload;

  switch (event.type) {
    case "GameCompleted": {
      const home = teamName(state, str(p, "homeTeamId"));
      const away = teamName(state, str(p, "awayTeamId"));
      const homeScore = num(p, "homeScore") ?? 0;
      const awayScore = num(p, "awayScore") ?? 0;
      const winner = homeScore >= awayScore ? home : away;
      const loser = homeScore >= awayScore ? away : home;
      const winScore = Math.max(homeScore, awayScore);
      const loseScore = Math.min(homeScore, awayScore);
      return {
        headline: `${winner} defeat ${loser}, ${winScore}–${loseScore}`,
        summary: `${away} ${awayScore}, ${home} ${homeScore}.`,
      };
    }
    case "PlayerInjured": {
      const name = playerName(state, str(p, "playerId"));
      const team = teamName(state, str(p, "teamId"));
      return {
        headline: `${name} sidelined for ${team}`,
        summary: `${name} has been ruled out with an injury.`,
      };
    }
    case "ContractSigned": {
      const name = playerName(state, str(p, "playerId"));
      const team = teamName(state, str(p, "teamId"));
      return {
        headline: `${name} signs with ${team}`,
        summary: `${team} finalize a contract with ${name}.`,
      };
    }
    case "PlayerTraded": {
      const name = playerName(state, str(p, "playerId"));
      const from = teamName(state, str(p, "fromTeamId"));
      const to = teamName(state, str(p, "toTeamId"));
      return {
        headline: `${name} traded to ${to}`,
        summary: `${name} moves from ${from} to ${to}.`,
      };
    }
    case "PlayerReleased": {
      const name = playerName(state, str(p, "playerId"));
      const team = teamName(state, str(p, "teamId"));
      return {
        headline: `${team} release ${name}`,
        summary: `${name} has been waived by ${team}.`,
      };
    }
    case "DraftPickMade": {
      const name = playerName(state, str(p, "playerId"));
      const team = teamName(state, str(p, "teamId"));
      const pick = num(p, "pickNumber");
      const pickLabel = pick != null ? ` at No. ${pick}` : "";
      return {
        headline: `${team} select ${name}${pickLabel}`,
        summary: `${team} use their draft pick on ${name}.`,
      };
    }
    case "FantasyDraftPickMade": {
      const name = playerName(state, str(p, "playerId"));
      const team = teamName(state, str(p, "teamId"));
      return {
        headline: `${team} draft ${name} in fantasy draft`,
        summary: `${name} is selected by ${team}.`,
      };
    }
    case "FreeAgentSigned": {
      const name = playerName(state, str(p, "playerId"));
      const team = teamName(state, str(p, "teamId"));
      return {
        headline: `${name} joins ${team}`,
        summary: `${team} sign free agent ${name}.`,
      };
    }
    case "OffseasonStageAdvanced": {
      const stage = str(p, "stage") ?? str(p, "toStage") ?? "next stage";
      return {
        headline: `League advances to ${stage}`,
        summary: `The offseason calendar moves forward to ${stage}.`,
      };
    }
    case "LeaguePhaseAdvanced": {
      const phase = str(p, "phase") ?? str(p, "toPhase") ?? "next phase";
      return {
        headline: `League enters ${phase}`,
        summary: `Competition phase advances to ${phase}.`,
      };
    }
    case "CoachHired": {
      const coachId = str(p, "coachId") ?? str(p, "staffId");
      const coach =
        coachId && state.world.coaches[coachId]
          ? `${state.world.coaches[coachId]!.firstName} ${state.world.coaches[coachId]!.lastName}`
          : coachId && state.world.staff[coachId]
            ? `${state.world.staff[coachId]!.firstName} ${state.world.staff[coachId]!.lastName}`
            : "New coach";
      const team = teamName(state, str(p, "teamId"));
      return {
        headline: `${team} hire ${coach}`,
        summary: `${coach} takes over as coach of ${team}.`,
      };
    }
    case "StaffHired": {
      const staffId = str(p, "staffId");
      const staff = staffId && state.world.staff[staffId]
        ? `${state.world.staff[staffId]!.firstName} ${state.world.staff[staffId]!.lastName}`
        : "New staff member";
      const team = teamName(state, str(p, "teamId"));
      return {
        headline: `${team} add ${staff} to staff`,
        summary: `${staff} joins the ${team} front office.`,
      };
    }
    case "StaffFired": {
      const staffId = str(p, "staffId");
      const staff = staffId && state.world.staff[staffId]
        ? `${state.world.staff[staffId]!.firstName} ${state.world.staff[staffId]!.lastName}`
        : "Staff member";
      const team = teamName(state, str(p, "teamId"));
      return {
        headline: `${team} part ways with ${staff}`,
        summary: `${staff} is no longer with ${team}.`,
      };
    }
    case "StaffRetired": {
      const staffId = str(p, "staffId");
      const staff = staffId && state.world.staff[staffId]
        ? `${state.world.staff[staffId]!.firstName} ${state.world.staff[staffId]!.lastName}`
        : "Staff member";
      return {
        headline: `${staff} retires`,
        summary: `${staff} announces retirement from the league.`,
      };
    }
    case "PlayerRetired": {
      const name = playerName(state, str(p, "playerId"));
      return {
        headline: `${name} retires`,
        summary: `${name} hangs up the sneakers.`,
      };
    }
    case "RfaQualifyingOfferIssued": {
      const name = playerName(state, str(p, "playerId"));
      const team = teamName(state, str(p, "teamId"));
      return {
        headline: `${team} extend qualifying offer to ${name}`,
        summary: `${name} receives a qualifying offer from ${team}.`,
      };
    }
    case "TradeOfferExpired": {
      return {
        headline: "Trade offer expires",
        summary: "A pending trade offer has expired without a deal.",
      };
    }
    case "FacilityUpgradeStarted": {
      const team = teamName(state, str(p, "teamId"));
      const facility = str(p, "facility") ?? str(p, "upgradeType") ?? "facility";
      return {
        headline: `${team} begin ${facility} upgrade`,
        summary: `${team} break ground on a ${facility} improvement.`,
      };
    }
    case "FacilityUpgradeCompleted": {
      const team = teamName(state, str(p, "teamId"));
      const facility = str(p, "facility") ?? str(p, "upgradeType") ?? "facility";
      return {
        headline: `${team} complete ${facility} upgrade`,
        summary: `${team} unveil an upgraded ${facility}.`,
      };
    }
    case "SponsorshipSigned": {
      const team = teamName(state, str(p, "teamId"));
      const sponsor = str(p, "sponsorName") ?? str(p, "sponsorId") ?? "a new partner";
      return {
        headline: `${team} land sponsorship with ${sponsor}`,
        summary: `${team} announce a commercial deal with ${sponsor}.`,
      };
    }
    case "SponsorshipExpired": {
      const team = teamName(state, str(p, "teamId"));
      return {
        headline: `${team} sponsorship expires`,
        summary: `A sponsorship agreement for ${team} has ended.`,
      };
    }
    case "RelocationStageChanged": {
      const team = teamName(state, str(p, "teamId"));
      const stage = str(p, "stage") ?? "next stage";
      return {
        headline: `${team} relocation: ${stage}`,
        summary: `Relocation process for ${team} moves to ${stage}.`,
      };
    }
    case "ExpansionStageChanged": {
      const stage = str(p, "stage") ?? "next stage";
      return {
        headline: `Expansion update: ${stage}`,
        summary: `League expansion advances to ${stage}.`,
      };
    }
    case "PlayerAssignedToDevelopmentLeague": {
      const name = playerName(state, str(p, "playerId"));
      const team = teamName(state, str(p, "teamId"));
      return {
        headline: `${name} assigned to development league`,
        summary: `${team} send ${name} to the development league.`,
      };
    }
    case "PlayerRecalledFromDevelopmentLeague": {
      const name = playerName(state, str(p, "playerId"));
      const team = teamName(state, str(p, "teamId"));
      return {
        headline: `${name} recalled by ${team}`,
        summary: `${name} returns from the development league.`,
      };
    }
    case "PlayerGraduatedFromDevelopmentLeague": {
      const name = playerName(state, str(p, "playerId"));
      const team = teamName(state, str(p, "teamId"));
      return {
        headline: `${name} graduates to ${team}`,
        summary: `${name} earns a full promotion from the development league.`,
      };
    }
    default: {
      return {
        headline: `${event.type.replace(/([A-Z])/g, " $1").trim()}`,
        summary: `League update on ${event.occurredOn}.`,
      };
    }
  }
}

/** Collect team / player ids referenced by a domain event payload. */
export function relatedIdsFromEvent(event: DomainEvent): {
  teamIds: TeamId[];
  playerIds: PlayerId[];
  gameId?: string;
  tradeId?: string;
} {
  const p = event.payload;
  const teamIds = new Set<string>();
  const playerIds = new Set<string>();

  const addTeam = (key: string) => {
    const value = str(p, key);
    if (value) teamIds.add(value);
  };
  const addPlayer = (key: string) => {
    const value = str(p, key);
    if (value) playerIds.add(value);
  };

  addTeam("teamId");
  addTeam("homeTeamId");
  addTeam("awayTeamId");
  addTeam("fromTeamId");
  addTeam("toTeamId");
  addTeam("offeringTeamId");
  addTeam("receivingTeamId");
  addPlayer("playerId");

  if (Array.isArray(p.playerIds)) {
    for (const id of p.playerIds) {
      if (typeof id === "string" && id.length > 0) {
        playerIds.add(id);
      }
    }
  }
  if (Array.isArray(p.teamIds)) {
    for (const id of p.teamIds) {
      if (typeof id === "string" && id.length > 0) {
        teamIds.add(id);
      }
    }
  }

  return {
    teamIds: [...teamIds].sort() as TeamId[],
    playerIds: [...playerIds].sort() as PlayerId[],
    gameId: str(p, "gameId"),
    tradeId: str(p, "tradeId"),
  };
}
