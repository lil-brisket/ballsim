import { beforeAll, describe, expect, it } from "vitest";
import { addCalendarDays } from "@/domain/calendar-date";
import { createContract, type ContractInput } from "@/domain/entities/contract";
import {
  createDraftPick,
  draftPickIdFor,
  type DraftPick,
} from "@/domain/entities/draft-pick";
import { createGame, type GameStatus } from "@/domain/entities/game";
import type { TradeProposal } from "@/domain/entities/trade-proposal";
import {
  asContractId,
  asDraftPickId,
  asGameId,
  asPlayerId,
  type DraftPickId,
  type PlayerId,
  type TeamId,
} from "@/domain/ids";
import { createSeededRng } from "@/domain/rng";
import type { GameState } from "@/state/game-state";
import { createDraft } from "@/systems/draft";
import {
  DRAFT_PICK_TRADE_HORIZON_YEARS,
  DRAFT_ROUNDS,
  PLAYER_RETIREMENT_HIGH_AGE,
  RFA_MATCH_WINDOW_DAYS,
  buildOfferSheet,
  canPerformAction,
  createPendingRfaStatus,
  type LeagueAction,
  type LeagueActionKind,
} from "@/systems/league-rules";
import { setActivePhase } from "@/systems/phase-engine";
import type { LeaguePhaseId } from "@/systems/phase-engine/phase-types";
import { TRADE_ROSTER_RULES } from "@/systems/trades-config";
import { createDraftFixture } from "../draft/fixture";
import { createPlayer } from "../../factories/player";
import { TEST_RNG_SEED } from "../../helpers/determinism";

const ALL_ACTION_KINDS = [
  "player_trade",
  "pick_trade",
  "trade",
  "sign_free_agent",
  "make_free_agent_offer",
  "submit_rfa_offer_sheet",
  "issue_rfa_qualifying_offer",
  "match_rfa_offer",
  "decline_rfa_match",
  "contract_extension",
  "player_release",
  "draft_selection",
  "advance_phase",
  "activate_draft",
  "begin_regular_season",
  "begin_playoffs",
] as const satisfies readonly LeagueActionKind[];

const TRADE_DEADLINE_DATE = "2027-02-15";
const TRADE_DEADLINE_EVE = "2027-02-14";
const RFA_SHEET_CREATED_ON = "2026-07-01";
const MISSING_PLAYER_ID = asPlayerId("player_does_not_exist");
const MISSING_PICK_ID = asDraftPickId("pick_does_not_exist_r1");
const ILLEGAL_ROUND_PICK_ID = asDraftPickId("pick_illegal_round_r3");

type GuardCase = {
  name: string;
  rule: string;
  variant: "legal" | "illegal" | "boundary";
  setup: (state: GameState) => GameState;
  action: (state: GameState) => LeagueAction;
  allowed: boolean;
  code?: string;
};

function teamPair(state: GameState): { teamA: TeamId; teamB: TeamId } {
  const ids = Object.keys(state.world.teams).sort() as TeamId[];
  return { teamA: ids[0]!, teamB: ids[1]! };
}

function firstPlayer(state: GameState, teamId: TeamId): PlayerId {
  return state.world.teams[teamId]!.roster[0]!;
}

function firstPickId(state: GameState): DraftPickId {
  const { teamA } = teamPair(state);
  return draftPickIdFor(teamA, state.competition.season.year + 1, 1);
}

function horizonPickId(state: GameState): DraftPickId {
  const { teamA } = teamPair(state);
  return draftPickIdFor(
    teamA,
    state.competition.season.year + DRAFT_PICK_TRADE_HORIZON_YEARS,
    2,
  );
}

function identity<T>(value: T): T {
  return value;
}

function withDate(state: GameState, currentDate: string): GameState {
  return {
    ...state,
    world: {
      ...state.world,
      calendar: { ...state.world.calendar, currentDate },
    },
  };
}

function withDeadline(state: GameState, tradeDeadlineDate: string): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      season: { ...state.competition.season, tradeDeadlineDate },
    },
  };
}

function withRfaQualificationComplete(
  state: GameState,
  rfaQualificationComplete: boolean,
): GameState {
  return {
    ...state,
    competition: {
      ...state.competition,
      season: { ...state.competition.season, rfaQualificationComplete },
    },
  };
}

function withRetired(
  state: GameState,
  playerId: PlayerId,
  retired: boolean,
  age?: number,
): GameState {
  const player = state.world.players[playerId]!;
  return {
    ...state,
    world: {
      ...state.world,
      players: {
        ...state.world.players,
        [playerId]: {
          ...player,
          retired,
          ...(age !== undefined ? { age } : {}),
        },
      },
    },
  };
}

function withPick(state: GameState, pick: DraftPick): GameState {
  return {
    ...state,
    world: {
      ...state.world,
      draftPicks: { ...state.world.draftPicks, [pick.id]: pick },
    },
  };
}

function withPickStatus(
  state: GameState,
  pickId: DraftPickId,
  status: DraftPick["status"],
): GameState {
  const pick = state.world.draftPicks[pickId]!;
  return withPick(state, { ...pick, status });
}

function withEmptyDrafts(state: GameState): GameState {
  return {
    ...state,
    world: { ...state.world, drafts: {} },
  };
}

function withDraftStatus(
  state: GameState,
  status: "not_started" | "active" | "complete",
): GameState {
  const drafts = Object.fromEntries(
    Object.entries(state.world.drafts).map(([draftId, draft]) => [
      draftId,
      { ...draft, status },
    ]),
  );
  return {
    ...state,
    world: { ...state.world, drafts },
  };
}

function mutateFirstDraft(
  state: GameState,
  mutate: (draft: GameState["world"]["drafts"][string]) => GameState["world"]["drafts"][string],
): GameState {
  const entries = Object.entries(state.world.drafts);
  const [draftId, draft] = entries[0]!;
  return {
    ...state,
    world: {
      ...state.world,
      drafts: { ...state.world.drafts, [draftId]: mutate(draft) },
    },
  };
}

function withTeamRosterSize(
  state: GameState,
  teamId: TeamId,
  size: number,
): GameState {
  const team = state.world.teams[teamId]!;
  const roster: PlayerId[] = [...team.roster];
  const players = { ...state.world.players };
  while (roster.length > size) {
    roster.pop();
  }
  while (roster.length < size) {
    const playerId = asPlayerId(`extra_${teamId}_${roster.length}`);
    players[playerId] = createPlayer({ id: playerId, teamId });
    roster.push(playerId);
  }
  return {
    ...state,
    world: {
      ...state.world,
      players,
      teams: { ...state.world.teams, [teamId]: { ...team, roster } },
    },
  };
}

function withAllRostersSize(state: GameState, size: number): GameState {
  let current = state;
  for (const teamId of Object.keys(state.world.teams) as TeamId[]) {
    current = withTeamRosterSize(current, teamId, size);
  }
  return current;
}

function withRegularGames(
  state: GameState,
  statuses: readonly GameStatus[],
): GameState {
  const { teamA, teamB } = teamPair(state);
  const games = { ...state.competition.games };
  const gameIds = [...state.competition.schedule.gameIds];
  statuses.forEach((status, index) => {
    const id = asGameId(`guard_game_${index}`);
    games[id] = createGame({
      id,
      seasonId: state.competition.season.id,
      homeTeamId: teamA,
      awayTeamId: teamB,
      date: "2026-10-15",
      competitionType: "regular_season",
      score: { home: 0, away: 0 },
      status,
      periodScores: [],
      events: [],
      playerStats: [],
      homeTeamSnapshot: null,
      awayTeamSnapshot: null,
    });
    gameIds.push(id);
  });
  return {
    ...state,
    competition: {
      ...state.competition,
      games,
      schedule: { ...state.competition.schedule, gameIds },
    },
  };
}

function rfaTerms(
  playerId: PlayerId,
  teamId: TeamId,
  year: number,
): ContractInput {
  return createContract({
    id: asContractId(`contract_rfa_${playerId}`),
    playerId,
    teamId,
    startYear: year,
    endYear: year + 1,
    salaryByYear: {
      [String(year)]: 5_000_000,
      [String(year + 1)]: 5_000_000,
    },
  });
}

function withPendingRfa(
  state: GameState,
  playerId: PlayerId,
  originalTeamId: TeamId,
): GameState {
  const status = createPendingRfaStatus({
    playerId,
    originalTeamId,
    seasonYear: state.competition.season.year,
    qualifyingOfferSalary: 5_000_000,
  });
  return {
    ...state,
    business: {
      ...state.business,
      rfaStatuses: { ...state.business.rfaStatuses, [playerId]: status },
    },
  };
}

function withPendingMatch(
  state: GameState,
  playerId: PlayerId,
  originalTeamId: TeamId,
  offeringTeamId: TeamId,
  createdOn: string,
): GameState {
  const pending = createPendingRfaStatus({
    playerId,
    originalTeamId,
    seasonYear: state.competition.season.year,
    qualifyingOfferSalary: 5_000_000,
  });
  const terms = rfaTerms(playerId, offeringTeamId, state.competition.season.year);
  const status = {
    ...pending,
    resolution: "pending_match" as const,
    activeOfferSheet: buildOfferSheet(offeringTeamId, terms, createdOn),
  };
  return {
    ...state,
    business: {
      ...state.business,
      rfaStatuses: { ...state.business.rfaStatuses, [playerId]: status },
    },
  };
}

function playerProposal(state: GameState): TradeProposal {
  const { teamA, teamB } = teamPair(state);
  return {
    sideA: {
      teamId: teamA,
      playerIds: [firstPlayer(state, teamA)],
      draftPickIds: [],
    },
    sideB: {
      teamId: teamB,
      playerIds: [firstPlayer(state, teamB)],
      draftPickIds: [],
    },
  };
}

function pickProposal(state: GameState, pickId: DraftPickId): TradeProposal {
  const { teamA, teamB } = teamPair(state);
  return {
    sideA: { teamId: teamA, playerIds: [], draftPickIds: [pickId] },
    sideB: { teamId: teamB, playerIds: [], draftPickIds: [] },
  };
}

function faAction(
  kind: "sign_free_agent" | "make_free_agent_offer",
  playerId: PlayerId,
  teamId: TeamId,
): LeagueAction {
  return { kind, playerId, teamId };
}

function rfaMatchDeadline(): string {
  return addCalendarDays(RFA_SHEET_CREATED_ON, RFA_MATCH_WINDOW_DAYS);
}

const CASES: GuardCase[] = [
  {
    name: "player trade during preseason",
    rule: "trade-window",
    variant: "legal",
    setup: identity,
    action: (state) => ({ kind: "player_trade", proposal: playerProposal(state) }),
    allowed: true,
  },
  {
    name: "trades closed in playoffs",
    rule: "trade-window",
    variant: "illegal",
    setup: (state) => setActivePhase(state, "playoffs"),
    action: (state) => ({ kind: "trade", proposal: playerProposal(state) }),
    allowed: false,
    code: "TRADES_CLOSED_PHASE",
  },
  {
    name: "trades not open during season transition",
    rule: "trade-window",
    variant: "illegal",
    setup: (state) => setActivePhase(state, "offseason.season_transition"),
    action: (state) => ({ kind: "trade", proposal: playerProposal(state) }),
    allowed: false,
    code: "TRADES_NOT_OPEN",
  },
  {
    name: "regular season day before deadline",
    rule: "trade-window",
    variant: "legal",
    setup: (state) =>
      withDate(
        withDeadline(setActivePhase(state, "regular"), TRADE_DEADLINE_DATE),
        TRADE_DEADLINE_EVE,
      ),
    action: (state) => ({ kind: "trade", proposal: playerProposal(state) }),
    allowed: true,
  },
  {
    name: "regular season exactly on deadline day",
    rule: "trade-window",
    variant: "boundary",
    setup: (state) =>
      withDate(
        withDeadline(setActivePhase(state, "regular"), TRADE_DEADLINE_DATE),
        TRADE_DEADLINE_DATE,
      ),
    action: (state) => ({ kind: "trade", proposal: playerProposal(state) }),
    allowed: false,
    code: "TRADE_DEADLINE_PASSED",
  },
  {
    name: "available round-2 pick at trade horizon",
    rule: "pick-tradability",
    variant: "legal",
    setup: identity,
    action: (state) => ({
      kind: "pick_trade",
      proposal: pickProposal(state, horizonPickId(state)),
    }),
    allowed: true,
  },
  {
    name: "missing pick",
    rule: "pick-tradability",
    variant: "illegal",
    setup: identity,
    action: (state) => ({
      kind: "pick_trade",
      proposal: pickProposal(state, MISSING_PICK_ID),
    }),
    allowed: false,
    code: "PICK_NOT_FOUND",
  },
  {
    name: "used pick",
    rule: "pick-tradability",
    variant: "illegal",
    setup: (state) => withPickStatus(state, firstPickId(state), "used"),
    action: (state) => ({
      kind: "pick_trade",
      proposal: pickProposal(state, firstPickId(state)),
    }),
    allowed: false,
    code: "PICK_ALREADY_USED",
  },
  {
    name: "pick one year beyond trade horizon",
    rule: "pick-tradability",
    variant: "boundary",
    setup: (state) => {
      const { teamA } = teamPair(state);
      const seasonYear =
        state.competition.season.year + DRAFT_PICK_TRADE_HORIZON_YEARS + 1;
      const pickId = draftPickIdFor(teamA, seasonYear, 1);
      return withPick(
        state,
        createDraftPick({
          id: pickId,
          originalTeamId: teamA,
          ownerTeamId: teamA,
          seasonYear,
          round: 1,
        }),
      );
    },
    action: (state) => {
      const { teamA } = teamPair(state);
      const seasonYear =
        state.competition.season.year + DRAFT_PICK_TRADE_HORIZON_YEARS + 1;
      return {
        kind: "pick_trade",
        proposal: pickProposal(state, draftPickIdFor(teamA, seasonYear, 1)),
      };
    },
    allowed: false,
    code: "PICK_BEYOND_HORIZON",
  },
  {
    name: "pick round above DRAFT_ROUNDS",
    rule: "pick-tradability",
    variant: "boundary",
    setup: (state) => {
      const { teamA } = teamPair(state);
      const valid = createDraftPick({
        id: ILLEGAL_ROUND_PICK_ID,
        originalTeamId: teamA,
        ownerTeamId: teamA,
        seasonYear: state.competition.season.year + 1,
        round: 1,
      });
      return withPick(state, { ...valid, round: DRAFT_ROUNDS + 1 } as DraftPick);
    },
    action: (state) => ({
      kind: "pick_trade",
      proposal: pickProposal(state, ILLEGAL_ROUND_PICK_ID),
    }),
    allowed: false,
    code: "INVALID_DRAFT_ROUND",
  },
  {
    name: "active player may be released",
    rule: "retirement",
    variant: "legal",
    setup: identity,
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "player_release",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: true,
  },
  {
    name: "retired player cannot be traded",
    rule: "retirement",
    variant: "illegal",
    setup: (state) => {
      const { teamA } = teamPair(state);
      return withRetired(state, firstPlayer(state, teamA), true);
    },
    action: (state) => ({ kind: "trade", proposal: playerProposal(state) }),
    allowed: false,
    code: "PLAYER_RETIRED",
  },
  {
    name: "retired player cannot be signed in free agency",
    rule: "retirement",
    variant: "illegal",
    setup: (state) => {
      const { teamA } = teamPair(state);
      return withRetired(
        setActivePhase(state, "offseason.free_agency"),
        firstPlayer(state, teamA),
        true,
      );
    },
    action: (state) => {
      const { teamA, teamB } = teamPair(state);
      return faAction("sign_free_agent", firstPlayer(state, teamA), teamB);
    },
    allowed: false,
    code: "PLAYER_RETIRED",
  },
  {
    name: "high retirement age is still legal when flag is false",
    rule: "retirement",
    variant: "boundary",
    setup: (state) => {
      const { teamA } = teamPair(state);
      return withRetired(
        state,
        firstPlayer(state, teamA),
        false,
        PLAYER_RETIREMENT_HIGH_AGE,
      );
    },
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "player_release",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: true,
  },
  {
    name: "UFA offer during free agency",
    rule: "free-agency",
    variant: "legal",
    setup: (state) => setActivePhase(state, "offseason.free_agency"),
    action: (state) => {
      const { teamA, teamB } = teamPair(state);
      return faAction(
        "make_free_agent_offer",
        firstPlayer(state, teamA),
        teamB,
      );
    },
    allowed: true,
  },
  {
    name: "free agency closed in preseason",
    rule: "free-agency",
    variant: "illegal",
    setup: identity,
    action: (state) => {
      const { teamA, teamB } = teamPair(state);
      return faAction("sign_free_agent", firstPlayer(state, teamA), teamB);
    },
    allowed: false,
    code: "FA_NOT_OPEN",
  },
  {
    name: "unknown free-agent player",
    rule: "free-agency",
    variant: "illegal",
    setup: (state) => setActivePhase(state, "offseason.free_agency"),
    action: (state) => {
      const { teamB } = teamPair(state);
      return faAction("sign_free_agent", MISSING_PLAYER_ID, teamB);
    },
    allowed: false,
    code: "PLAYER_NOT_FOUND",
  },
  {
    name: "active RFA cannot use UFA signing path",
    rule: "free-agency",
    variant: "illegal",
    setup: (state) => {
      const { teamA } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return withPendingRfa(
        setActivePhase(state, "offseason.free_agency"),
        playerId,
        teamA,
      );
    },
    action: (state) => {
      const { teamA, teamB } = teamPair(state);
      return faAction("sign_free_agent", firstPlayer(state, teamA), teamB);
    },
    allowed: false,
    code: "RFA_REQUIRES_OFFER_SHEET",
  },
  {
    name: "adjacent staff-development phase still closed",
    rule: "free-agency",
    variant: "boundary",
    setup: (state) => setActivePhase(state, "offseason.staff_development"),
    action: (state) => {
      const { teamA, teamB } = teamPair(state);
      return faAction("sign_free_agent", firstPlayer(state, teamA), teamB);
    },
    allowed: false,
    code: "FA_NOT_OPEN",
  },
  {
    name: "qualifying offer during roster decisions",
    rule: "rfa-qo",
    variant: "legal",
    setup: (state) => setActivePhase(state, "offseason.roster_decisions"),
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "issue_rfa_qualifying_offer",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: true,
  },
  {
    name: "qualifying offer in the wrong phase",
    rule: "rfa-qo",
    variant: "illegal",
    setup: identity,
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "issue_rfa_qualifying_offer",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: false,
    code: "RFA_QO_WRONG_PHASE",
  },
  {
    name: "qualifying offer from a different team",
    rule: "rfa-qo",
    variant: "illegal",
    setup: (state) => setActivePhase(state, "offseason.roster_decisions"),
    action: (state) => {
      const { teamA, teamB } = teamPair(state);
      return {
        kind: "issue_rfa_qualifying_offer",
        playerId: firstPlayer(state, teamA),
        teamId: teamB,
      };
    },
    allowed: false,
    code: "RFA_QO_WRONG_TEAM",
  },
  {
    name: "qualifying offer already issued",
    rule: "rfa-qo",
    variant: "boundary",
    setup: (state) => {
      const { teamA } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return withPendingRfa(
        setActivePhase(state, "offseason.roster_decisions"),
        playerId,
        teamA,
      );
    },
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "issue_rfa_qualifying_offer",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: false,
    code: "RFA_QO_ALREADY_ISSUED",
  },
  {
    name: "offer sheet from another team during free agency",
    rule: "rfa-offer-sheet",
    variant: "legal",
    setup: (state) => {
      const { teamA } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return withPendingRfa(
        setActivePhase(state, "offseason.free_agency"),
        playerId,
        teamA,
      );
    },
    action: (state) => {
      const { teamA, teamB } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return {
        kind: "submit_rfa_offer_sheet",
        playerId,
        offeringTeamId: teamB,
        terms: rfaTerms(playerId, teamB, state.competition.season.year),
      };
    },
    allowed: true,
  },
  {
    name: "original team cannot submit an offer sheet",
    rule: "rfa-offer-sheet",
    variant: "illegal",
    setup: (state) => {
      const { teamA } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return withPendingRfa(
        setActivePhase(state, "offseason.free_agency"),
        playerId,
        teamA,
      );
    },
    action: (state) => {
      const { teamA } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return {
        kind: "submit_rfa_offer_sheet",
        playerId,
        offeringTeamId: teamA,
        terms: rfaTerms(playerId, teamA, state.competition.season.year),
      };
    },
    allowed: false,
    code: "RFA_SHEET_OWN_TEAM",
  },
  {
    name: "offer sheet outside free agency",
    rule: "rfa-offer-sheet",
    variant: "illegal",
    setup: (state) => {
      const { teamA } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return withPendingRfa(
        setActivePhase(state, "offseason.roster_decisions"),
        playerId,
        teamA,
      );
    },
    action: (state) => {
      const { teamA, teamB } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return {
        kind: "submit_rfa_offer_sheet",
        playerId,
        offeringTeamId: teamB,
        terms: rfaTerms(playerId, teamB, state.competition.season.year),
      };
    },
    allowed: false,
    code: "RFA_SHEET_WRONG_PHASE",
  },
  {
    name: "second offer sheet while one is active",
    rule: "rfa-offer-sheet",
    variant: "boundary",
    setup: (state) => {
      const { teamA, teamB } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return withPendingMatch(
        setActivePhase(state, "offseason.free_agency"),
        playerId,
        teamA,
        teamB,
        RFA_SHEET_CREATED_ON,
      );
    },
    action: (state) => {
      const { teamA, teamB } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return {
        kind: "submit_rfa_offer_sheet",
        playerId,
        offeringTeamId: teamB,
        terms: rfaTerms(playerId, teamB, state.competition.season.year),
      };
    },
    allowed: false,
    code: "RFA_SHEET_ALREADY_ACTIVE",
  },
  {
    name: "original team matches on the deadline day",
    rule: "rfa-match",
    variant: "legal",
    setup: (state) => {
      const { teamA, teamB } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return withDate(
        withPendingMatch(
          setActivePhase(state, "offseason.free_agency"),
          playerId,
          teamA,
          teamB,
          RFA_SHEET_CREATED_ON,
        ),
        rfaMatchDeadline(),
      );
    },
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "match_rfa_offer",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: true,
  },
  {
    name: "wrong team cannot match",
    rule: "rfa-match",
    variant: "illegal",
    setup: (state) => {
      const { teamA, teamB } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return withPendingMatch(
        setActivePhase(state, "offseason.free_agency"),
        playerId,
        teamA,
        teamB,
        RFA_SHEET_CREATED_ON,
      );
    },
    action: (state) => {
      const { teamA, teamB } = teamPair(state);
      return {
        kind: "match_rfa_offer",
        playerId: firstPlayer(state, teamA),
        teamId: teamB,
      };
    },
    allowed: false,
    code: "RFA_MATCH_WRONG_TEAM",
  },
  {
    name: "match window closed the day after the deadline",
    rule: "rfa-match",
    variant: "boundary",
    setup: (state) => {
      const { teamA, teamB } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return withDate(
        withPendingMatch(
          setActivePhase(state, "offseason.free_agency"),
          playerId,
          teamA,
          teamB,
          RFA_SHEET_CREATED_ON,
        ),
        addCalendarDays(rfaMatchDeadline(), 1),
      );
    },
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "match_rfa_offer",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: false,
    code: "RFA_MATCH_WINDOW_CLOSED",
  },
  {
    name: "original team declines a pending match",
    rule: "rfa-decline",
    variant: "legal",
    setup: (state) => {
      const { teamA, teamB } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return withPendingMatch(
        setActivePhase(state, "offseason.free_agency"),
        playerId,
        teamA,
        teamB,
        RFA_SHEET_CREATED_ON,
      );
    },
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "decline_rfa_match",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: true,
  },
  {
    name: "decline outside free agency",
    rule: "rfa-decline",
    variant: "illegal",
    setup: (state) => {
      const { teamA, teamB } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return withPendingMatch(
        setActivePhase(state, "offseason.roster_decisions"),
        playerId,
        teamA,
        teamB,
        RFA_SHEET_CREATED_ON,
      );
    },
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "decline_rfa_match",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: false,
    code: "RFA_DECLINE_WRONG_PHASE",
  },
  {
    name: "decline with no pending match",
    rule: "rfa-decline",
    variant: "illegal",
    setup: (state) => {
      const { teamA } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return withPendingRfa(
        setActivePhase(state, "offseason.free_agency"),
        playerId,
        teamA,
      );
    },
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "decline_rfa_match",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: false,
    code: "RFA_NO_PENDING_MATCH",
  },
  {
    name: "other team cannot decline the same pending sheet",
    rule: "rfa-decline",
    variant: "boundary",
    setup: (state) => {
      const { teamA, teamB } = teamPair(state);
      const playerId = firstPlayer(state, teamA);
      return withPendingMatch(
        setActivePhase(state, "offseason.free_agency"),
        playerId,
        teamA,
        teamB,
        RFA_SHEET_CREATED_ON,
      );
    },
    action: (state) => {
      const { teamA, teamB } = teamPair(state);
      return {
        kind: "decline_rfa_match",
        playerId: firstPlayer(state, teamA),
        teamId: teamB,
      };
    },
    allowed: false,
    code: "RFA_DECLINE_WRONG_TEAM",
  },
  {
    name: "extension during roster decisions",
    rule: "contract-extension",
    variant: "legal",
    setup: (state) => setActivePhase(state, "offseason.roster_decisions"),
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "contract_extension",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: true,
  },
  {
    name: "extension closed in playoffs",
    rule: "contract-extension",
    variant: "illegal",
    setup: (state) => setActivePhase(state, "playoffs"),
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "contract_extension",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: false,
    code: "EXTENSION_WINDOW_CLOSED",
  },
  {
    name: "extension closed outside roster decisions",
    rule: "contract-extension",
    variant: "boundary",
    setup: identity,
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "contract_extension",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: false,
    code: "EXTENSION_WINDOW_CLOSED",
  },
  {
    name: "release during playoffs",
    rule: "player-release",
    variant: "legal",
    setup: (state) => setActivePhase(state, "playoffs"),
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "player_release",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: true,
  },
  {
    name: "release closed during season transition",
    rule: "player-release",
    variant: "illegal",
    setup: (state) => setActivePhase(state, "offseason.season_transition"),
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "player_release",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: false,
    code: "RELEASE_WINDOW_CLOSED",
  },
  {
    name: "release reopens at roster decisions",
    rule: "player-release",
    variant: "boundary",
    setup: (state) => setActivePhase(state, "offseason.roster_decisions"),
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "player_release",
        playerId: firstPlayer(state, teamA),
        teamId: teamA,
      };
    },
    allowed: true,
  },
  {
    name: "draft selection during the draft",
    rule: "draft-selection",
    variant: "legal",
    setup: (state) => setActivePhase(state, "offseason.draft"),
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "draft_selection",
        draftPickId: firstPickId(state),
        teamId: teamA,
      };
    },
    allowed: true,
  },
  {
    name: "draft selection during draft preparation",
    rule: "draft-selection",
    variant: "illegal",
    setup: (state) => setActivePhase(state, "offseason.draft_preparation"),
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "draft_selection",
        draftPickId: firstPickId(state),
        teamId: teamA,
      };
    },
    allowed: false,
    code: "DRAFT_WRONG_PHASE",
  },
  {
    name: "draft selection in adjacent free-agency phase",
    rule: "draft-selection",
    variant: "boundary",
    setup: (state) => setActivePhase(state, "offseason.free_agency"),
    action: (state) => {
      const { teamA } = teamPair(state);
      return {
        kind: "draft_selection",
        draftPickId: firstPickId(state),
        teamId: teamA,
      };
    },
    allowed: false,
    code: "DRAFT_WRONG_PHASE",
  },
  {
    name: "activate draft with a finalized order",
    rule: "activate-draft",
    variant: "legal",
    setup: identity,
    action: () => ({ kind: "activate_draft" }),
    allowed: true,
  },
  {
    name: "activate draft with no draft class",
    rule: "activate-draft",
    variant: "illegal",
    setup: withEmptyDrafts,
    action: () => ({ kind: "activate_draft" }),
    allowed: false,
    code: "DRAFT_CLASS_MISSING",
  },
  {
    name: "activate draft with a duplicate pick in the order",
    rule: "activate-draft",
    variant: "illegal",
    setup: (state) =>
      mutateFirstDraft(state, (draft) => ({
        ...draft,
        order: draft.order.map((slot, index) =>
          index === 1
            ? { ...slot, draftPickId: draft.order[0]!.draftPickId }
            : slot,
        ),
      })),
    action: () => ({ kind: "activate_draft" }),
    allowed: false,
    code: "DUPLICATE_DRAFT_PICK",
  },
  {
    name: "activate draft when order is one pick short",
    rule: "activate-draft",
    variant: "boundary",
    setup: (state) =>
      mutateFirstDraft(state, (draft) => ({
        ...draft,
        order: draft.order.slice(0, -1),
      })),
    action: () => ({ kind: "activate_draft" }),
    allowed: false,
    code: "DRAFT_ORDER_INVALID",
  },
  {
    name: "leave roster decisions for draft preparation",
    rule: "advance-phase",
    variant: "legal",
    setup: (state) => setActivePhase(state, "offseason.roster_decisions"),
    action: () => ({
      kind: "advance_phase",
      toPhaseId: "offseason.draft_preparation" satisfies LeaguePhaseId,
    }),
    allowed: true,
  },
  {
    name: "cannot manually leave season transition",
    rule: "advance-phase",
    variant: "illegal",
    setup: (state) => setActivePhase(state, "offseason.season_transition"),
    action: () => ({
      kind: "advance_phase",
      toPhaseId: "offseason.roster_decisions",
    }),
    allowed: false,
    code: "AUTOMATIC_PHASE",
  },
  {
    name: "cannot leave an incomplete draft",
    rule: "advance-phase",
    variant: "illegal",
    setup: (state) =>
      withDraftStatus(setActivePhase(state, "offseason.draft"), "not_started"),
    action: () => ({
      kind: "advance_phase",
      toPhaseId: "offseason.staff_development",
    }),
    allowed: false,
    code: "DRAFT_NOT_COMPLETE",
  },
  {
    name: "free agency requires RFA qualification after a complete draft",
    rule: "advance-phase",
    variant: "boundary",
    setup: (state) =>
      withRfaQualificationComplete(
        withDraftStatus(
          setActivePhase(state, "offseason.staff_development"),
          "complete",
        ),
        false,
      ),
    action: () => ({
      kind: "advance_phase",
      toPhaseId: "offseason.free_agency",
    }),
    allowed: false,
    code: "RFA_QUALIFICATION_INCOMPLETE",
  },
  {
    name: "enter free agency when draft is complete and RFA qualification is done",
    rule: "advance-phase",
    variant: "legal",
    setup: (state) =>
      withRfaQualificationComplete(
        withDraftStatus(
          setActivePhase(state, "offseason.staff_development"),
          "complete",
        ),
        true,
      ),
    action: () => ({
      kind: "advance_phase",
      toPhaseId: "offseason.free_agency",
    }),
    allowed: true,
  },
  {
    name: "begin regular season with default rosters",
    rule: "begin-regular-season",
    variant: "legal",
    setup: identity,
    action: () => ({ kind: "begin_regular_season" }),
    allowed: true,
  },
  {
    name: "begin regular season with a roster below the minimum",
    rule: "begin-regular-season",
    variant: "illegal",
    setup: (state) => {
      const { teamA } = teamPair(state);
      return withTeamRosterSize(
        state,
        teamA,
        TRADE_ROSTER_RULES.minRosterSize - 1,
      );
    },
    action: () => ({ kind: "begin_regular_season" }),
    allowed: false,
    code: "ROSTER_INVALID",
  },
  {
    name: "begin regular season at the minimum roster size",
    rule: "begin-regular-season",
    variant: "boundary",
    setup: (state) =>
      withAllRostersSize(state, TRADE_ROSTER_RULES.minRosterSize),
    action: () => ({ kind: "begin_regular_season" }),
    allowed: true,
  },
  {
    name: "begin regular season with one team at the maximum roster size",
    rule: "begin-regular-season",
    variant: "boundary",
    setup: (state) => {
      const { teamA } = teamPair(state);
      return withTeamRosterSize(
        state,
        teamA,
        TRADE_ROSTER_RULES.maxRosterSize,
      );
    },
    action: () => ({ kind: "begin_regular_season" }),
    allowed: true,
  },
  {
    name: "begin regular season with a roster above the maximum",
    rule: "begin-regular-season",
    variant: "boundary",
    setup: (state) => {
      const { teamA } = teamPair(state);
      return withTeamRosterSize(
        state,
        teamA,
        TRADE_ROSTER_RULES.maxRosterSize + 1,
      );
    },
    action: () => ({ kind: "begin_regular_season" }),
    allowed: false,
    code: "ROSTER_INVALID",
  },
  {
    name: "begin playoffs when every regular-season game is final",
    rule: "begin-playoffs",
    variant: "legal",
    setup: (state) => withRegularGames(state, ["final", "final"]),
    action: () => ({ kind: "begin_playoffs" }),
    allowed: true,
  },
  {
    name: "begin playoffs with an empty schedule",
    rule: "begin-playoffs",
    variant: "illegal",
    setup: identity,
    action: () => ({ kind: "begin_playoffs" }),
    allowed: false,
    code: "REGULAR_SEASON_INCOMPLETE",
  },
  {
    name: "begin playoffs with one remaining scheduled regular-season game",
    rule: "begin-playoffs",
    variant: "boundary",
    setup: (state) => withRegularGames(state, ["final", "scheduled"]),
    action: () => ({ kind: "begin_playoffs" }),
    allowed: false,
    code: "REGULAR_SEASON_INCOMPLETE",
  },
];

describe("canPerformAction", () => {
  let base: GameState;

  beforeAll(() => {
    const fixture = createDraftFixture();
    const rng = createSeededRng(TEST_RNG_SEED);
    base = createDraft(fixture, rng).state;
  });

  it.each(CASES)("$rule — $variant: $name", ({ setup, action, allowed, code }) => {
    const state = setup(structuredClone(base));
    const result = canPerformAction(state, action(state));
    expect(result.allowed).toBe(allowed);
    if (code !== undefined) {
      expect(result.violations.map((violation) => violation.code)).toContain(
        code,
      );
    } else {
      expect(result.violations).toEqual([]);
    }
  });

  it("covers every LeagueAction kind", () => {
    const kinds = new Set(
      CASES.map((row) => row.action(structuredClone(base)).kind),
    );
    expect([...ALL_ACTION_KINDS].sort()).toEqual([...kinds].sort());
  });

  it("covers legal, illegal, and boundary variants for every rule", () => {
    const variantsByRule = new Map<string, Set<GuardCase["variant"]>>();
    for (const row of CASES) {
      const variants = variantsByRule.get(row.rule) ?? new Set();
      variants.add(row.variant);
      variantsByRule.set(row.rule, variants);
    }
    for (const [rule, variants] of variantsByRule) {
      expect(variants, rule).toEqual(
        new Set(["legal", "illegal", "boundary"]),
      );
    }
  });
});
