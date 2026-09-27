import { describe, expect, it } from "vitest";
import {
  customDateRangeError,
  parseActivityMode,
  parseTransactionDateRange,
  parseTransactionFilterGroup,
  parseTransactionHubQuery,
  parseTransactionSortKey,
  toTransactionHubSearchParams,
  toTransactionHubView,
  TRANSACTION_FILTER_GROUPS,
  type TransactionHubFilters,
  type TransactionHubView,
} from "@/state/transaction-hub-selectors";
import { createTestGameState } from "../factories/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { createSeededRng } from "@/domain/rng";
import { createDomainEvent, type DomainEvent } from "@/domain/events";
import { appendSeasonEventLog, type GameState } from "@/state/game-state";
import { createContract } from "@/domain/entities/contract";
import { asContractId, asPlayerId, asTeamId } from "@/domain/ids";
import { getActiveOwnerTeamId } from "@/state/owner-context";

function filters(
  overrides: Partial<TransactionHubFilters> = {},
): TransactionHubFilters {
  return {
    group: "all",
    teamId: null,
    range: "season",
    search: "",
    limit: 25,
    sort: "newest",
    activityMode: "league",
    ...overrides,
  };
}

function flatten(view: TransactionHubView) {
  return view.groups.flatMap((group) => group.rows);
}

function withEvents(state: GameState, events: DomainEvent[]): GameState {
  return appendSeasonEventLog(state, events);
}

function signingEvent(input: {
  occurredOn: string;
  playerId: string;
  teamId: string;
  contractId?: string;
}): DomainEvent {
  return createDomainEvent({
    type: "ContractSigned",
    occurredOn: input.occurredOn,
    payload: {
      playerId: input.playerId,
      teamId: input.teamId,
      ...(input.contractId ? { contractId: input.contractId } : {}),
    },
  });
}

describe("transaction-hub-selectors", () => {
  it("filter groups map to domain event types", () => {
    expect(TRANSACTION_FILTER_GROUPS.trades).toContain("PlayerTraded");
    expect(TRANSACTION_FILTER_GROUPS.signings).toContain("FreeAgentSigned");
    expect(TRANSACTION_FILTER_GROUPS.releases).toContain("PlayerReleased");
    expect(TRANSACTION_FILTER_GROUPS.draft).toContain("DraftPickMade");
    expect(TRANSACTION_FILTER_GROUPS.draft).not.toContain("ContractSigned");
    expect(TRANSACTION_FILTER_GROUPS.other).not.toContain("DraftPickMade");
    expect(TRANSACTION_FILTER_GROUPS.other).toContain("CoachHired");
    expect(TRANSACTION_FILTER_GROUPS.waivers).toEqual([]);
    expect(TRANSACTION_FILTER_GROUPS.extensions).toEqual([]);
  });

  it("groups multi-player same-day trades into two-sided rows", () => {
    let state = createTestGameState({ saveId: "txn_trade" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const teams = Object.values(state.world.teams);
    const teamA = teams[0]!;
    const teamB = teams[1]!;
    const players = Object.values(state.world.players).filter(
      (p) => p.teamId === teamA.id || p.teamId === teamB.id,
    );
    const p1 = players.find((p) => p.teamId === teamA.id);
    const p2 = players.find((p) => p.teamId === teamB.id);
    if (!p1 || !p2) {
      return;
    }

    const date = state.world.calendar.currentDate;
    const events = [
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn: date,
        payload: {
          playerId: p1.id,
          fromTeamId: teamA.id,
          toTeamId: teamB.id,
        },
      }),
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn: date,
        payload: {
          playerId: p2.id,
          fromTeamId: teamB.id,
          toTeamId: teamA.id,
        },
      }),
    ];
    state = appendSeasonEventLog(state, events);

    const view = toTransactionHubView(state, filters({ group: "trades" }));

    const tradeRow = flatten(view).find((r) => r.type === "PlayerTraded");
    expect(tradeRow).toBeDefined();
    expect(tradeRow!.tradeSides).not.toBeNull();
    expect(tradeRow!.tradeSides!.length).toBe(2);
    expect(tradeRow!.contractValue).toBeNull();
  });

  it("orders newest first", () => {
    let state = createTestGameState({ saveId: "txn_order" });
    const rng = createSeededRng(state.meta.rngState);
    state = bootstrapWorld(state, rng).state;

    const view = toTransactionHubView(state, filters({ limit: 50 }));

    const dates = view.groups.map((g) => g.date);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]! >= dates[i]!).toBe(true);
    }
  });
});

describe("transaction hub parsers", () => {
  it("accepts valid transaction type groups and falls back for invalid", () => {
    expect(parseTransactionFilterGroup("trades")).toBe("trades");
    expect(parseTransactionFilterGroup("draft")).toBe("draft");
    expect(parseTransactionFilterGroup("waivers")).toBe("waivers");
    expect(parseTransactionFilterGroup("extensions")).toBe("extensions");
    expect(parseTransactionFilterGroup("nope")).toBe("all");
    expect(parseTransactionFilterGroup(undefined)).toBe("all");
  });

  it("accepts valid date ranges and falls back for invalid", () => {
    expect(parseTransactionDateRange("today")).toBe("today");
    expect(parseTransactionDateRange("7d")).toBe("7d");
    expect(parseTransactionDateRange("30d")).toBe("30d");
    expect(parseTransactionDateRange("season")).toBe("season");
    expect(parseTransactionDateRange("custom")).toBe("custom");
    expect(parseTransactionDateRange("week")).toBe("season");
    expect(parseTransactionDateRange(undefined)).toBe("season");
  });

  it("accepts valid sort values and falls back for invalid", () => {
    expect(parseTransactionSortKey("oldest")).toBe("oldest");
    expect(parseTransactionSortKey("contract")).toBe("contract");
    expect(parseTransactionSortKey("player")).toBe("player");
    expect(parseTransactionSortKey("bogus")).toBe("newest");
    expect(parseTransactionSortKey(undefined)).toBe("newest");
  });

  it("accepts valid activity values and falls back for invalid", () => {
    expect(parseActivityMode("myTeam")).toBe("myTeam");
    expect(parseActivityMode("league")).toBe("league");
    expect(parseActivityMode("my-team")).toBe("league");
    expect(parseActivityMode("all")).toBe("league");
    expect(parseActivityMode(undefined)).toBe("league");
  });

  it("parseTransactionHubQuery normalizes the full query object", () => {
    const parsed = parseTransactionHubQuery({
      type: "draft",
      team: "my",
      range: "custom",
      q: "smith",
      limit: "50",
      sort: "oldest",
      activity: "myTeam",
      start: "2026-01-01",
      end: "2026-03-31",
    });
    expect(parsed).toEqual({
      group: "draft",
      teamParam: "my",
      range: "custom",
      search: "smith",
      limit: 50,
      sort: "oldest",
      activityMode: "myTeam",
      start: "2026-01-01",
      end: "2026-03-31",
    });
  });

  it("parseTransactionHubQuery clamps limit and applies defaults", () => {
    expect(parseTransactionHubQuery({}).limit).toBe(25);
    expect(parseTransactionHubQuery({ limit: "999" }).limit).toBe(200);
    expect(parseTransactionHubQuery({ limit: "-1" }).limit).toBe(25);
    expect(parseTransactionHubQuery({ type: "nope" }).group).toBe("all");
  });

  it("toTransactionHubSearchParams omits defaults", () => {
    const empty = toTransactionHubSearchParams({
      group: "all",
      range: "season",
      sort: "newest",
      activityMode: "league",
      search: "",
    });
    expect(empty.toString()).toBe("");

    const full = toTransactionHubSearchParams({
      group: "draft",
      teamParam: "my",
      range: "custom",
      start: "2026-01-01",
      end: "2026-03-31",
      sort: "oldest",
      activityMode: "myTeam",
      search: "smith",
      limit: 50,
    });
    expect(full.get("type")).toBe("draft");
    expect(full.get("team")).toBe("my");
    expect(full.get("range")).toBe("custom");
    expect(full.get("start")).toBe("2026-01-01");
    expect(full.get("end")).toBe("2026-03-31");
    expect(full.get("sort")).toBe("oldest");
    expect(full.get("activity")).toBe("myTeam");
    expect(full.get("q")).toBe("smith");
    expect(full.get("limit")).toBe("50");

    const notCustom = toTransactionHubSearchParams({
      group: "all",
      range: "7d",
      start: "2026-01-01",
      end: "2026-03-31",
      sort: "newest",
      activityMode: "league",
      search: "",
    });
    expect(notCustom.get("start")).toBeNull();
    expect(notCustom.get("end")).toBeNull();
  });
});

describe("custom date filtering", () => {
  it("reports validation errors without throwing", () => {
    expect(customDateRangeError(undefined, "2026-01-02")).toMatch(/required/);
    expect(customDateRangeError("2026-01-01", undefined)).toMatch(/required/);
    expect(customDateRangeError("not-a-date", "2026-01-02")).toMatch(
      /YYYY-MM-DD/,
    );
    expect(customDateRangeError("2026-01-02", "2026-01-01")).toMatch(/before/);
    expect(customDateRangeError("2026-01-01", "2026-01-01")).toBeNull();
  });

  it("includes the exact same-day custom range", () => {
    let state = createTestGameState({ saveId: "txn_custom_same" });
    const myTeamId = getActiveOwnerTeamId(state);
    state = withEvents(state, [
      signingEvent({
        occurredOn: "2026-02-10",
        playerId: "p_same",
        teamId: myTeamId,
      }),
      signingEvent({
        occurredOn: "2026-02-11",
        playerId: "p_next",
        teamId: myTeamId,
      }),
    ]);
    const view = toTransactionHubView(
      state,
      filters({
        range: "custom",
        start: "2026-02-10",
        end: "2026-02-10",
      }),
    );
    expect(flatten(view).map((row) => row.occurredOn)).toEqual(["2026-02-10"]);
  });

  it("treats custom start and end as inclusive", () => {
    let state = createTestGameState({ saveId: "txn_custom_incl" });
    const myTeamId = getActiveOwnerTeamId(state);
    state = withEvents(state, [
      signingEvent({
        occurredOn: "2026-01-01",
        playerId: "p_start",
        teamId: myTeamId,
      }),
      signingEvent({
        occurredOn: "2026-01-15",
        playerId: "p_mid",
        teamId: myTeamId,
      }),
      signingEvent({
        occurredOn: "2026-01-31",
        playerId: "p_end",
        teamId: myTeamId,
      }),
      signingEvent({
        occurredOn: "2026-02-01",
        playerId: "p_after",
        teamId: myTeamId,
      }),
    ]);
    const view = toTransactionHubView(
      state,
      filters({
        range: "custom",
        start: "2026-01-01",
        end: "2026-01-31",
      }),
    );
    expect(
      flatten(view)
        .map((row) => row.occurredOn)
        .sort(),
    ).toEqual(["2026-01-01", "2026-01-15", "2026-01-31"]);
  });

  it("returns zero rows for invalid, missing, or reversed custom dates — not season", () => {
    let state = createTestGameState({ saveId: "txn_custom_bad" });
    const myTeamId = getActiveOwnerTeamId(state);
    state = withEvents(state, [
      signingEvent({
        occurredOn: "2026-03-01",
        playerId: "p_any",
        teamId: myTeamId,
      }),
    ]);

    const invalid = toTransactionHubView(
      state,
      filters({ range: "custom", start: "bad", end: "2026-03-01" }),
    );
    const missing = toTransactionHubView(state, filters({ range: "custom" }));
    const reversed = toTransactionHubView(
      state,
      filters({
        range: "custom",
        start: "2026-03-10",
        end: "2026-03-01",
      }),
    );
    const season = toTransactionHubView(state, filters({ range: "season" }));

    expect(flatten(invalid)).toHaveLength(0);
    expect(flatten(missing)).toHaveLength(0);
    expect(flatten(reversed)).toHaveLength(0);
    expect(flatten(season).length).toBeGreaterThan(0);
  });
});

describe("transaction filter groups", () => {
  it("routes draft, other, waivers, and extensions without overlapping DraftPickMade", () => {
    let state = createTestGameState({ saveId: "txn_groups" });
    const myTeamId = getActiveOwnerTeamId(state);
    state = withEvents(state, [
      createDomainEvent({
        type: "DraftPickMade",
        occurredOn: "2026-06-01",
        payload: { playerId: "p_draft", teamId: myTeamId },
      }),
      createDomainEvent({
        type: "CoachHired",
        occurredOn: "2026-06-01",
        payload: { teamId: myTeamId },
      }),
      createDomainEvent({
        type: "PlayerReleased",
        occurredOn: "2026-06-01",
        payload: { playerId: "p_rel", teamId: myTeamId },
      }),
    ]);

    const draftRows = flatten(
      toTransactionHubView(state, filters({ group: "draft" })),
    );
    const otherRows = flatten(
      toTransactionHubView(state, filters({ group: "other" })),
    );
    const waiverRows = flatten(
      toTransactionHubView(state, filters({ group: "waivers" })),
    );
    const extensionRows = flatten(
      toTransactionHubView(state, filters({ group: "extensions" })),
    );

    expect(draftRows.map((row) => row.type)).toEqual(["DraftPickMade"]);
    expect(otherRows.map((row) => row.type)).toEqual(["CoachHired"]);
    expect(waiverRows).toHaveLength(0);
    expect(extensionRows).toHaveLength(0);
  });
});

describe("team filtering", () => {
  it("filters all / my / selected teams", () => {
    let state = createTestGameState({ saveId: "txn_team" });
    const teams = Object.values(state.world.teams);
    const myTeamId = getActiveOwnerTeamId(state);
    const otherTeamId = teams.find((team) => team.id !== myTeamId)!.id;
    state = withEvents(state, [
      signingEvent({
        occurredOn: "2026-04-01",
        playerId: "p_mine",
        teamId: myTeamId,
      }),
      signingEvent({
        occurredOn: "2026-04-01",
        playerId: "p_other",
        teamId: otherTeamId,
      }),
    ]);

    const allRows = flatten(toTransactionHubView(state, filters()));
    const myRows = flatten(
      toTransactionHubView(state, filters({ teamId: myTeamId })),
    );
    const selectedRows = flatten(
      toTransactionHubView(state, filters({ teamId: otherTeamId })),
    );

    expect(allRows).toHaveLength(2);
    expect(myRows).toHaveLength(1);
    expect(myRows[0]!.players[0]!.id).toBe("p_mine");
    expect(selectedRows).toHaveLength(1);
    expect(selectedRows[0]!.players[0]!.id).toBe("p_other");
  });
});

describe("activity mode", () => {
  it("league keeps every row and myTeam drops non-franchise rows", () => {
    let state = createTestGameState({ saveId: "txn_activity" });
    const myTeamId = getActiveOwnerTeamId(state);
    const otherTeamId = Object.values(state.world.teams).find(
      (team) => team.id !== myTeamId,
    )!.id;
    state = withEvents(state, [
      signingEvent({
        occurredOn: "2026-04-02",
        playerId: "p_mine",
        teamId: myTeamId,
      }),
      signingEvent({
        occurredOn: "2026-04-02",
        playerId: "p_other",
        teamId: otherTeamId,
      }),
    ]);

    const league = flatten(
      toTransactionHubView(state, filters({ activityMode: "league" })),
    );
    const mine = flatten(
      toTransactionHubView(state, filters({ activityMode: "myTeam" })),
    );

    expect(league).toHaveLength(2);
    expect(league.filter((row) => row.isMyTeam)).toHaveLength(1);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.isMyTeam).toBe(true);
    expect(mine[0]!.players[0]!.id).toBe("p_mine");
  });

  it("marks grouped trades as isMyTeam when the franchise participates", () => {
    let state = createTestGameState({ saveId: "txn_activity_trade" });
    const myTeamId = getActiveOwnerTeamId(state);
    const others = Object.values(state.world.teams).filter(
      (team) => team.id !== myTeamId,
    );
    const otherA = others[0]!.id;
    const otherB = others[1]!.id;
    state = withEvents(state, [
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn: "2026-07-01",
        payload: {
          playerId: "p_out",
          fromTeamId: myTeamId,
          toTeamId: otherA,
        },
      }),
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn: "2026-07-01",
        payload: {
          playerId: "p_in",
          fromTeamId: otherA,
          toTeamId: myTeamId,
        },
      }),
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn: "2026-07-02",
        payload: {
          playerId: "p_away_1",
          fromTeamId: otherA,
          toTeamId: otherB,
        },
      }),
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn: "2026-07-02",
        payload: {
          playerId: "p_away_2",
          fromTeamId: otherB,
          toTeamId: otherA,
        },
      }),
    ]);

    const league = flatten(
      toTransactionHubView(
        state,
        filters({ group: "trades", activityMode: "league" }),
      ),
    );
    const mine = flatten(
      toTransactionHubView(
        state,
        filters({ group: "trades", activityMode: "myTeam" }),
      ),
    );

    expect(league).toHaveLength(2);
    const myTrade = league.find((row) => row.isMyTeam);
    const otherTrade = league.find((row) => !row.isMyTeam);
    expect(myTrade).toBeDefined();
    expect(otherTrade).toBeDefined();
    expect(mine).toHaveLength(1);
    expect(mine[0]!.isMyTeam).toBe(true);
    expect(mine[0]!.id).toBe(myTrade!.id);
  });
});

describe("row sorting", () => {
  it("sorts newest and oldest with id tie-breaks", () => {
    let state = createTestGameState({ saveId: "txn_sort_date" });
    const myTeamId = getActiveOwnerTeamId(state);
    const early = signingEvent({
      occurredOn: "2026-01-01",
      playerId: "p_early",
      teamId: myTeamId,
    });
    const lateA = signingEvent({
      occurredOn: "2026-05-01",
      playerId: "p_late_a",
      teamId: myTeamId,
    });
    const lateB = signingEvent({
      occurredOn: "2026-05-01",
      playerId: "p_late_b",
      teamId: myTeamId,
    });
    state = withEvents(state, [early, lateA, lateB]);

    const newest = flatten(
      toTransactionHubView(state, filters({ sort: "newest" })),
    );
    const oldest = flatten(
      toTransactionHubView(state, filters({ sort: "oldest" })),
    );

    expect(newest[0]!.occurredOn).toBe("2026-05-01");
    expect(newest[newest.length - 1]!.id).toBe(early.id);
    const sameDayNewest = newest.filter(
      (row) => row.occurredOn === "2026-05-01",
    );
    expect(sameDayNewest[0]!.id >= sameDayNewest[1]!.id).toBe(true);

    expect(oldest[0]!.id).toBe(early.id);
    expect(oldest[oldest.length - 1]!.occurredOn).toBe("2026-05-01");
    const sameDayOldest = oldest.filter(
      (row) => row.occurredOn === "2026-05-01",
    );
    expect(sameDayOldest[0]!.id <= sameDayOldest[1]!.id).toBe(true);
  });

  it("sorts by team, player, and type with date/id tie-breaks", () => {
    let state = createTestGameState({ saveId: "txn_sort_keys" });
    state = withEvents(state, [
      signingEvent({
        occurredOn: "2026-04-01",
        playerId: "Zoe",
        teamId: "zzz_team",
      }),
      signingEvent({
        occurredOn: "2026-04-01",
        playerId: "Ada",
        teamId: "aaa_team",
      }),
      createDomainEvent({
        type: "PlayerReleased",
        occurredOn: "2026-04-01",
        payload: { playerId: "Mia", teamId: "mmm_team" },
      }),
    ]);

    const byTeam = flatten(
      toTransactionHubView(state, filters({ sort: "team" })),
    );
    expect(byTeam.map((row) => row.teams[0]?.name)).toEqual([
      "aaa_team",
      "mmm_team",
      "zzz_team",
    ]);

    const byPlayer = flatten(
      toTransactionHubView(state, filters({ sort: "player" })),
    );
    expect(byPlayer.map((row) => row.players[0]?.name)).toEqual([
      "Ada",
      "Mia",
      "Zoe",
    ]);

    const byType = flatten(
      toTransactionHubView(state, filters({ sort: "type" })),
    );
    expect(byType.map((row) => row.type)).toEqual([
      "ContractSigned",
      "ContractSigned",
      "PlayerReleased",
    ]);
  });

  it("sorts contract value descending with nulls last", () => {
    let state = createTestGameState({ saveId: "txn_sort_contract" });
    const myTeamId = getActiveOwnerTeamId(state);
    const high = createContract({
      id: asContractId("contract_high"),
      playerId: asPlayerId("p_high"),
      teamId: asTeamId(myTeamId),
      startYear: 2026,
      endYear: 2027,
      salaryByYear: { "2026": 10_000_000, "2027": 10_000_000 },
    });
    const low = createContract({
      id: asContractId("contract_low"),
      playerId: asPlayerId("p_low"),
      teamId: asTeamId(myTeamId),
      startYear: 2026,
      endYear: 2026,
      salaryByYear: { "2026": 1_000_000 },
    });
    state = {
      ...state,
      business: {
        ...state.business,
        contracts: {
          ...state.business.contracts,
          [high.id]: high,
          [low.id]: low,
        },
      },
    };
    state = withEvents(state, [
      signingEvent({
        occurredOn: "2026-08-01",
        playerId: "p_low",
        teamId: myTeamId,
        contractId: low.id,
      }),
      signingEvent({
        occurredOn: "2026-08-01",
        playerId: "p_high",
        teamId: myTeamId,
        contractId: high.id,
      }),
      createDomainEvent({
        type: "PlayerReleased",
        occurredOn: "2026-08-01",
        payload: { playerId: "p_none", teamId: myTeamId },
      }),
    ]);

    const rows = flatten(
      toTransactionHubView(state, filters({ sort: "contract" })),
    );
    expect(rows.map((row) => row.contractValue)).toEqual([
      20_000_000,
      1_000_000,
      null,
    ]);
  });

  it("sorts grouped trades as a single row", () => {
    let state = createTestGameState({ saveId: "txn_sort_grouped" });
    const myTeamId = getActiveOwnerTeamId(state);
    const otherTeamId = Object.values(state.world.teams).find(
      (team) => team.id !== myTeamId,
    )!.id;
    state = withEvents(state, [
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn: "2026-07-15",
        payload: {
          playerId: "p_out",
          fromTeamId: myTeamId,
          toTeamId: otherTeamId,
        },
      }),
      createDomainEvent({
        type: "PlayerTraded",
        occurredOn: "2026-07-15",
        payload: {
          playerId: "p_in",
          fromTeamId: otherTeamId,
          toTeamId: myTeamId,
        },
      }),
      signingEvent({
        occurredOn: "2026-07-16",
        playerId: "p_sign",
        teamId: myTeamId,
      }),
    ]);

    const newest = flatten(
      toTransactionHubView(state, filters({ sort: "newest" })),
    );
    expect(newest).toHaveLength(2);
    expect(newest.filter((row) => row.type === "PlayerTraded")).toHaveLength(1);

    const byType = flatten(
      toTransactionHubView(state, filters({ sort: "type" })),
    );
    expect(byType.map((row) => row.type)).toEqual([
      "ContractSigned",
      "PlayerTraded",
    ]);
  });
});

describe("pagination after sort", () => {
  it("keeps total, shown, and hasMore correct", () => {
    let state = createTestGameState({ saveId: "txn_page" });
    const myTeamId = getActiveOwnerTeamId(state);
    state = withEvents(state, [
      signingEvent({
        occurredOn: "2026-01-01",
        playerId: "p1",
        teamId: myTeamId,
      }),
      signingEvent({
        occurredOn: "2026-02-01",
        playerId: "p2",
        teamId: myTeamId,
      }),
      signingEvent({
        occurredOn: "2026-03-01",
        playerId: "p3",
        teamId: myTeamId,
      }),
    ]);

    const view = toTransactionHubView(
      state,
      filters({ sort: "oldest", limit: 2 }),
    );
    expect(view.total).toBe(3);
    expect(view.shown).toBe(2);
    expect(view.hasMore).toBe(true);
    expect(flatten(view).map((row) => row.occurredOn)).toEqual([
      "2026-01-01",
      "2026-02-01",
    ]);
  });

  it("paginates the globally sorted slice before date grouping", () => {
    let state = createTestGameState({ saveId: "txn_page_contract" });
    const myTeamId = getActiveOwnerTeamId(state);
    const high = createContract({
      id: asContractId("contract_page_high"),
      playerId: asPlayerId("p_high"),
      teamId: asTeamId(myTeamId),
      startYear: 2026,
      endYear: 2026,
      salaryByYear: { "2026": 9_000_000 },
    });
    state = {
      ...state,
      business: {
        ...state.business,
        contracts: { ...state.business.contracts, [high.id]: high },
      },
    };
    state = withEvents(state, [
      signingEvent({
        occurredOn: "2026-01-01",
        playerId: "p_high",
        teamId: myTeamId,
        contractId: high.id,
      }),
      createDomainEvent({
        type: "PlayerReleased",
        occurredOn: "2026-12-01",
        payload: { playerId: "p_none", teamId: myTeamId },
      }),
    ]);

    const view = toTransactionHubView(
      state,
      filters({ sort: "contract", limit: 1 }),
    );
    expect(view.total).toBe(2);
    expect(view.shown).toBe(1);
    expect(view.hasMore).toBe(true);
    expect(flatten(view)[0]!.contractValue).toBe(9_000_000);
  });
});
