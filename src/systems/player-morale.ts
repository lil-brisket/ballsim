/**
 * Player morale: one 0–100 mood per rostered player, updated weekly during
 * the regular season and playoffs.
 *
 * Each week morale moves part of the way toward a target built from:
 * - role: planned minutes against what his rating on that roster expects;
 * - team success: win%;
 * - contract: an underpaid star sours;
 * - talks: a fresh extension lifts him, a refused one stings.
 * Composure and leadership slow the swings.
 *
 * Effects (each small): a trade request after {@link MORALE_TRADE_REQUEST_WEEKS}
 * straight weeks under {@link MORALE_TRADE_REQUEST_BELOW} (once a season), a
 * complaint about minutes, a lower loyalty pull in free agency and a higher
 * extension ask. No in-game effect. No RNG.
 */

import { calendarDaysBetween } from "@/domain/calendar-date";
import { getContractSalaryForYear } from "@/domain/entities/contract";
import type {
  PlayerMorale,
  MoraleReason,
} from "@/domain/entities/player-morale";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import type { PlayerId, TeamId } from "@/domain/ids";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { appendSeasonEventLog } from "@/state/game-state";
import { isUserControlledTeam } from "@/state/owner-context";
import { addToTradeBlock } from "@/systems/trades/trade-block";
import { getTopLeagueRosterPlayerIds } from "@/systems/development-league/franchise-membership";
import { getLeagueSalaryCap } from "@/systems/league-salary-cap";
import { salaryForPlayer, serviceYearsForSalary } from "@/systems/salary-scale";

export const MORALE_DEFAULT = 60;
/** Share of the gap to the target closed in a week (before damping). */
export const MORALE_WEEKLY_STEP = 0.3;
export const MORALE_TRADE_REQUEST_BELOW = 30;
export const MORALE_TRADE_REQUEST_WEEKS = 4;
export const MORALE_COMPLAINT_BELOW = 40;
/** A star paid this far under market sours. */
export const MORALE_UNDERPAID_RATIO = 1.5;
export const MORALE_STAR_OVERALL = 80;
export const MORALE_RECENT_TALKS_DAYS = 60;

export const MORALE_REASON_LABELS: Record<MoraleReason, string> = {
  role: "Wants more minutes",
  happy_role: "Happy with his role",
  losing: "Tired of losing",
  winning: "Enjoying the winning",
  underpaid: "Feels underpaid",
  extended: "Happy with his new deal",
  talks_failed: "Stung by contract talks",
  settled: "Settled",
};

export function getPlayerMorale(
  state: GameState,
  playerId: PlayerId,
): PlayerMorale {
  return (
    state.business.playerMorale?.[playerId] ?? {
      value: MORALE_DEFAULT,
      reason: "settled",
      lowWeeks: 0,
      tradeRequestSeason: null,
      complaintSeason: null,
    }
  );
}

type Driver = { reason: MoraleReason; delta: number };

/** Target morale and the drivers behind it. */
export function moraleTarget(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): { target: number; drivers: Driver[] } {
  const drivers: Driver[] = [];
  const role = roleDriver(state, playerId, teamId);
  drivers.push({ reason: role >= 0 ? "happy_role" : "role", delta: role });

  const standing = state.competition.standings.byTeamId[teamId];
  const played = (standing?.wins ?? 0) + (standing?.losses ?? 0);
  if (standing && played > 0) {
    const win = (standing.wins / played - 0.5) * 30;
    drivers.push({ reason: win >= 0 ? "winning" : "losing", delta: win });
  }

  const underpaid = underpaidDriver(state, playerId);
  if (underpaid !== 0) drivers.push({ reason: "underpaid", delta: underpaid });

  const talks = talksDriver(state, playerId);
  if (talks !== null) drivers.push(talks);

  const target = Math.max(
    0,
    Math.min(
      100,
      MORALE_DEFAULT + drivers.reduce((sum, d) => sum + d.delta, 0),
    ),
  );
  return { target, drivers };
}

/** Minutes against what his rank on the roster expects; −20..+10. */
function roleDriver(
  state: GameState,
  playerId: PlayerId,
  teamId: TeamId,
): number {
  const team = state.world.teams[teamId];
  const player = state.world.players[playerId];
  if (!team || !player) return 0;
  const mine = calculatePlayerOverall(player.position, player.attributes);
  const better = getTopLeagueRosterPlayerIds(teamId, state).filter((id) => {
    const other = state.world.players[id];
    return (
      id !== playerId &&
      other !== undefined &&
      calculatePlayerOverall(other.position, other.attributes) > mine
    );
  }).length;
  const expected = better < 5 ? 28 : better < 8 ? 18 : better < 10 ? 10 : 0;
  const entry = team.rosterManagement?.rotation.find(
    (r) => r.playerId === playerId,
  );
  const minutes = entry?.targetMinutes ?? 0;
  const gap = minutes - expected;
  return gap >= 0 ? Math.min(10, gap / 2) : Math.max(-20, gap);
}

function underpaidDriver(state: GameState, playerId: PlayerId): number {
  const player = state.world.players[playerId];
  if (!player || player.contractId == null) return 0;
  const contract = state.business.contracts[player.contractId];
  const overall = calculatePlayerOverall(player.position, player.attributes);
  if (!contract || overall < MORALE_STAR_OVERALL) return 0;
  const year = state.competition.season.year;
  const salary = getContractSalaryForYear(contract, year) ?? 0;
  const market = salaryForPlayer({
    overall,
    age: player.age,
    years: serviceYearsForSalary({
      age: player.age,
      seasonYear: year,
      draftSeasonYear: player.developmentLeague?.draftSeasonYear ?? null,
      seasonsPlayed:
        state.business.playerHistory[playerId]?.seasons.length ?? 0,
    }),
    cap: getLeagueSalaryCap(state),
    kind: "fa",
  });
  return salary > 0 && market >= salary * MORALE_UNDERPAID_RATIO ? -15 : 0;
}

function talksDriver(state: GameState, playerId: PlayerId): Driver | null {
  const today = state.world.calendar.currentDate;
  const recent = (date: string) =>
    calendarDaysBetween(date, today) <= MORALE_RECENT_TALKS_DAYS;
  const talks = state.business.extensionTalks?.[playerId];
  if (talks?.lastRefusedOn && recent(talks.lastRefusedOn)) {
    return { reason: "talks_failed", delta: -8 };
  }
  for (const event of state.competition.seasonEventLog) {
    if (
      event.type === "ContractSigned" &&
      event.payload.playerId === playerId &&
      event.payload.reason === "extension" &&
      recent(event.occurredOn)
    ) {
      return { reason: "extended", delta: 10 };
    }
  }
  return null;
}

/** Composure and leadership slow swings: 0.6x–1.15x of the weekly step. */
function swingFactor(state: GameState, playerId: PlayerId): number {
  const p = state.world.players[playerId]?.personality;
  if (!p) return 1;
  return Math.max(
    0.6,
    Math.min(1.15, 1 - (p.composure - 50) / 200 - (p.leadership - 50) / 400),
  );
}

/**
 * Weekly morale update for every rostered player, in season only.
 * Deterministic; emits trade requests and minutes complaints.
 */
export function processWeeklyMorale(state: GameState): SystemResult {
  const phase = state.competition.season.phase;
  if (phase !== "regular" && phase !== "playoffs") {
    return systemResult(state);
  }
  const season = state.competition.season.year;
  const next: Record<string, PlayerMorale> = {
    ...(state.business.playerMorale ?? {}),
  };
  const events: DomainEvent[] = [];
  const today = state.world.calendar.currentDate;

  for (const teamId of Object.keys(state.world.teams).sort() as TeamId[]) {
    for (const playerId of getTopLeagueRosterPlayerIds(teamId, state)) {
      const player = state.world.players[playerId];
      if (!player || player.retired === true) continue;
      const current = getPlayerMorale(state, playerId);
      const { target, drivers } = moraleTarget(state, playerId, teamId);
      const step = MORALE_WEEKLY_STEP * swingFactor(state, playerId);
      const value = Math.round(current.value + (target - current.value) * step);
      const main = [...drivers].sort(
        (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
      )[0];
      const reason: MoraleReason =
        main && Math.abs(main.delta) >= 3 ? main.reason : "settled";
      const lowWeeks =
        value < MORALE_TRADE_REQUEST_BELOW ? current.lowWeeks + 1 : 0;
      let tradeRequestSeason = current.tradeRequestSeason;
      let complaintSeason = current.complaintSeason;

      if (
        lowWeeks >= MORALE_TRADE_REQUEST_WEEKS &&
        tradeRequestSeason !== season
      ) {
        tradeRequestSeason = season;
        events.push(
          createDomainEvent({
            type: "PlayerTradeRequested",
            occurredOn: today,
            payload: {
              playerId,
              teamId,
              morale: value,
              reason,
            },
          }),
        );
      } else if (
        value < MORALE_COMPLAINT_BELOW &&
        reason === "role" &&
        complaintSeason !== season
      ) {
        complaintSeason = season;
        events.push(
          createDomainEvent({
            type: "PlayerMinutesComplaint",
            occurredOn: today,
            payload: { playerId, teamId, morale: value },
          }),
        );
      }
      next[playerId] = {
        value: Math.max(0, Math.min(100, value)),
        reason,
        lowWeeks,
        tradeRequestSeason,
        complaintSeason,
      };
    }
  }

  let updated: GameState = {
    ...state,
    business: { ...state.business, playerMorale: next },
  };
  // CPU teams put a player who asked out on the trade block.
  for (const event of events) {
    if (event.type !== "PlayerTradeRequested") continue;
    const teamId = event.payload.teamId as TeamId;
    if (isUserControlledTeam(updated, teamId)) continue;
    try {
      updated = addToTradeBlock(updated, teamId, {
        kind: "player",
        playerId: event.payload.playerId as PlayerId,
      }).state;
    } catch {
      // Not his team any more: nothing to list.
    }
  }
  return systemResult(appendSeasonEventLog(updated, events), events);
}

/** Morale's pull on free agency and extensions: 1 neutral, <1 unhappy. */
export function moraleFactor(state: GameState, playerId: PlayerId): number {
  const value = getPlayerMorale(state, playerId).value;
  return Math.max(0, Math.min(1, value / MORALE_DEFAULT));
}
