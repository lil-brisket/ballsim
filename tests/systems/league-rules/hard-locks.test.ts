import { describe, expect, it } from "vitest";
import { addCalendarDays, calendarDaysBetween } from "@/domain/calendar-date";
import { createDraftPick, draftPickIdFor } from "@/domain/entities/draft-pick";
import { asTeamId } from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import {
  areTradesOpen,
  getCalendarContext,
  resolveTradeDeadlineDate,
} from "@/systems/simulation/calendar-context";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { validateTrade } from "@/systems/trades/trade-validation";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import {
  TRADE_DEADLINE_SEASON_FRACTION,
  DRAFT_PICK_TRADE_HORIZON_YEARS,
  canPerformAction,
  canTradeDraftPick,
  maxTradablePickSeasonYear,
  resolveHardLockTradeDeadlineDate,
  isFreeAgencyOpen,
  getActionBlockReason,
} from "@/systems/league-rules";
import { serializeGameState, deserializeGameState } from "@/persistence/mappers/game-state-mapper";
import { setActivePhase } from "@/systems/phase-engine";
import { processPlayerRetirements } from "@/systems/player-retirement";

describe("league hard locks", () => {
  describe("trade deadline calendar span", () => {
    it("uses 60% of calendar span, not games played", () => {
      expect(TRADE_DEADLINE_SEASON_FRACTION).toBe(0.6);
      const start = "2026-10-01";
      const end = "2027-04-01";
      const spanDays = calendarDaysBetween(start, end);
      expect(spanDays).toBe(182);
      const deadline = resolveHardLockTradeDeadlineDate(start, end);
      expect(deadline).toBe(addCalendarDays(start, Math.round(182 * 0.6)));
      expect(deadline).toBe("2027-01-18");
    });

    it("closes trades on the deadline day (strict <)", () => {
      const start = "2026-10-01";
      const end = "2027-04-01";
      const deadline = resolveHardLockTradeDeadlineDate(start, end)!;
      expect(areTradesOpen("regular", addCalendarDays(deadline, -1), deadline)).toBe(
        true,
      );
      expect(areTradesOpen("regular", deadline, deadline)).toBe(false);
      expect(areTradesOpen("regular", addCalendarDays(deadline, 1), deadline)).toBe(
        false,
      );
    });

    it("resolveTradeDeadlineDate ignores settings fraction (hard lock 0.6)", () => {
      const start = "2026-10-01";
      const end = "2027-04-01";
      const hard = resolveHardLockTradeDeadlineDate(start, end);
      const fromSettings = resolveTradeDeadlineDate(
        { kind: "fraction_of_season_span", seasonSpanFraction: 0.55 },
        start,
        end,
      );
      expect(fromSettings).toBe(hard);
    });

    it("snapshots tradeDeadlineDate when regular season begins", () => {
      let state = createInitialGameState({
        saveId: "hl_deadline_snap",
        rngSeed: 11,
        settings: CBL_GAME_SETTINGS,
      });
      const rng = createSeededRng(state.meta.rngState);
      state = bootstrapWorld(state, rng).state;
      state = beginRegularSeasonFromPreseason(state).state;
      expect(state.competition.season.tradeDeadlineDate).toBeTruthy();
      const ctx = getCalendarContext(state);
      expect(ctx.tradeDeadlineDate).toBe(
        state.competition.season.tradeDeadlineDate,
      );
    });
  });

  describe("draft pick horizon and used picks", () => {
    it("allows Y+3 and rejects Y+4", () => {
      let state = createInitialGameState({
        saveId: "hl_pick_horizon",
        rngSeed: 3,
        settings: CBL_GAME_SETTINGS,
      });
      const rng = createSeededRng(state.meta.rngState);
      state = bootstrapWorld(state, rng).state;
      const year = state.competition.season.year;
      const teamId = Object.keys(state.world.teams)[0]! as ReturnType<
        typeof asTeamId
      >;
      const maxYear = maxTradablePickSeasonYear(year);
      expect(maxYear).toBe(year + DRAFT_PICK_TRADE_HORIZON_YEARS);

      const okPick = createDraftPick({
        id: draftPickIdFor(teamId, maxYear, 1),
        originalTeamId: teamId,
        ownerTeamId: teamId,
        seasonYear: maxYear,
        round: 1,
        status: "available",
      });
      const badPick = createDraftPick({
        id: draftPickIdFor(teamId, maxYear + 1, 1),
        originalTeamId: teamId,
        ownerTeamId: teamId,
        seasonYear: maxYear + 1,
        round: 1,
        status: "available",
      });
      state = {
        ...state,
        world: {
          ...state.world,
          draftPicks: {
            ...state.world.draftPicks,
            [okPick.id]: okPick,
            [badPick.id]: badPick,
          },
        },
      };
      expect(canTradeDraftPick(state, okPick.id).allowed).toBe(true);
      expect(canTradeDraftPick(state, badPick.id).allowed).toBe(false);
    });

    it("rejects used picks", () => {
      let state = createInitialGameState({
        saveId: "hl_pick_used",
        rngSeed: 4,
        settings: CBL_GAME_SETTINGS,
      });
      const rng = createSeededRng(state.meta.rngState);
      state = bootstrapWorld(state, rng).state;
      const pickId = Object.keys(state.world.draftPicks)[0]!;
      const pick = state.world.draftPicks[pickId]!;
      state = {
        ...state,
        world: {
          ...state.world,
          draftPicks: {
            ...state.world.draftPicks,
            [pickId]: { ...pick, status: "used" },
          },
        },
      };
      const result = canTradeDraftPick(state, pick.id);
      expect(result.allowed).toBe(false);
      expect(result.violations[0]?.code).toBe("PICK_ALREADY_USED");
    });
  });

  describe("free agency phase lock", () => {
    it("blocks FA signing outside free_agency phase", () => {
      let state = createInitialGameState({
        saveId: "hl_fa_phase",
        rngSeed: 5,
        settings: CBL_GAME_SETTINGS,
      });
      const rng = createSeededRng(state.meta.rngState);
      state = bootstrapWorld(state, rng).state;
      expect(isFreeAgencyOpen(state)).toBe(false);
      const playerId = Object.keys(state.world.players)[0]!;
      const teamId = Object.keys(state.world.teams)[0]!;
      const blocked = canPerformAction(state, {
        kind: "sign_free_agent",
        playerId: playerId as never,
        teamId: teamId as never,
      });
      expect(blocked.allowed).toBe(false);
      expect(getActionBlockReason(state, {
        kind: "sign_free_agent",
        playerId: playerId as never,
        teamId: teamId as never,
      })).toMatch(/Free agency is not open/i);
    });
  });

  describe("pick-only trades after deadline", () => {
    it("rejects pick-only trades after deadline during regular season", () => {
      let state = createInitialGameState({
        saveId: "hl_pick_deadline",
        rngSeed: 6,
        settings: CBL_GAME_SETTINGS,
      });
      const rng = createSeededRng(state.meta.rngState);
      state = bootstrapWorld(state, rng).state;
      state = beginRegularSeasonFromPreseason(state).state;
      const deadline = state.competition.season.tradeDeadlineDate!;
      state = {
        ...state,
        world: {
          ...state.world,
          calendar: {
            ...state.world.calendar,
            currentDate: deadline,
          },
        },
      };
      const teamIds = Object.keys(state.world.teams).sort();
      const teamA = teamIds[0]!;
      const teamB = teamIds[1]!;
      const pickA = Object.values(state.world.draftPicks).find(
        (p) => p.ownerTeamId === teamA && p.status !== "used",
      )!;
      const pickB = Object.values(state.world.draftPicks).find(
        (p) => p.ownerTeamId === teamB && p.status !== "used",
      )!;
      const proposal: TradeProposal = {
        sideA: {
          teamId: teamA as never,
          playerIds: [],
          draftPickIds: [pickA.id],
        },
        sideB: {
          teamId: teamB as never,
          playerIds: [],
          draftPickIds: [pickB.id],
        },
      };
      const result = validateTrade(state, proposal);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "TRADE_DEADLINE_PASSED")).toBe(
        true,
      );
    });
  });

  describe("retirement idempotency", () => {
    it("does not re-process an already-retired player", () => {
      let state = createInitialGameState({
        saveId: "hl_retire",
        rngSeed: 99,
        settings: CBL_GAME_SETTINGS,
      });
      const rng = createSeededRng(state.meta.rngState);
      state = bootstrapWorld(state, rng).state;
      const playerId = Object.keys(state.world.players)[0]!;
      // Force retired
      state = {
        ...state,
        world: {
          ...state.world,
          players: {
            ...state.world.players,
            [playerId]: {
              ...state.world.players[playerId]!,
              age: 40,
              retired: true,
              teamId: null,
              contractId: null,
            },
          },
        },
      };
      const before = state.world.players[playerId]!;
      const result = processPlayerRetirements(state, createSeededRng(1));
      expect(result.state.world.players[playerId]!.retired).toBe(true);
      expect(result.events.filter((e) => e.payload.playerId === playerId)).toHaveLength(
        0,
      );
      expect(result.state.world.players[playerId]).toEqual(before);
    });
  });

  describe("save/load parity", () => {
    it("preserves hard-lock fields after round-trip", () => {
      let state = createInitialGameState({
        saveId: "hl_saveload",
        rngSeed: 8,
        settings: CBL_GAME_SETTINGS,
      });
      const rng = createSeededRng(state.meta.rngState);
      state = bootstrapWorld(state, rng).state;
      state = beginRegularSeasonFromPreseason(state).state;
      const json = serializeGameState(state);
      const loaded = deserializeGameState(json);
      expect(loaded.competition.season.tradeDeadlineDate).toBe(
        state.competition.season.tradeDeadlineDate,
      );
      expect(loaded.business.rfaStatuses).toEqual({});
      expect(loaded.meta.schemaVersion).toBe(54);
      const before = canPerformAction(state, { kind: "activate_draft" });
      const after = canPerformAction(loaded, { kind: "activate_draft" });
      expect(after.allowed).toBe(before.allowed);
    });
  });

  describe("phase authority", () => {
    it("getActivePhaseId prefers competition.phase", () => {
      let state = createInitialGameState({
        saveId: "hl_phase",
        rngSeed: 9,
        settings: CBL_GAME_SETTINGS,
      });
      state = setActivePhase(state, "offseason.free_agency");
      expect(state.competition.phase.activePhaseId).toBe(
        "offseason.free_agency",
      );
      expect(state.competition.season.phase).toBe("offseason");
      expect(isFreeAgencyOpen(state)).toBe(true);
    });
  });
});
