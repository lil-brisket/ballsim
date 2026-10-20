import { describe, expect, it } from "vitest";
import { createSeededRng } from "@/domain/rng";
import { CBL_GAME_SETTINGS } from "@/domain/game-settings";
import { createInitialGameState } from "@/state/create-initial-state";
import type { GameState } from "@/state/game-state";
import { bootstrapWorld } from "@/systems/world-pipeline";
import { beginRegularSeasonFromPreseason } from "@/systems/simulation/season-lifecycle";
import { generateRosters } from "@/systems/roster-generation";
import {
  finalizeAllStarSelections,
  processSeasonEvents,
} from "@/systems/season-events";
import { advanceSimulation } from "@/systems/simulation/advance-simulation";
import { addCalendarDays } from "@/domain/calendar-date";
import { qualifyAndStartTournament } from "@/systems/season-events/tournament-engine";
import { asFanVoteCategoryId } from "@/domain/ids";
import type { FanVoteCategory } from "@/domain/entities/season-events";

function bootRegularSeason(saveId: string) {
  let state = createInitialGameState({
    saveId,
    rngSeed: 99,
    settings: {
      ...CBL_GAME_SETTINGS,
      seasonEvents: {
        ...CBL_GAME_SETTINGS.seasonEvents,
        tournamentFieldSize: 4,
      },
    },
  });
  const rng = createSeededRng(state.meta.rngState);
  state = bootstrapWorld(state, rng).state;
  state = generateRosters(state, rng).state;
  state = beginRegularSeasonFromPreseason(state).state;
  return { state, rng };
}

describe("season events midseason cycle", () => {
  it("finalizes fan voting and announces All-Star selections", () => {
    const { state, rng } = bootRegularSeason("se_allstar");
    const campaign = Object.values(
      state.competition.seasonEvents.fanVoting,
    )[0]!;

    let current: GameState = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: campaign.closeDate,
          lastSimulatedDate: addCalendarDays(campaign.closeDate, -1),
        },
      },
    };

    // Open and tick through close in one process after jumping calendar
    // First ensure open from openDate via catch-up ticks inside processFanVoting
    const result = processSeasonEvents(current, rng);
    current = result.state;
    const updated = Object.values(
      current.competition.seasonEvents.fanVoting,
    )[0]!;
    expect(updated.status).toBe("finalized");

    const allStar = current.competition.seasonEvents.allStar!;
    expect(
      allStar.status === "selections_announced" ||
        allStar.status === "completed",
    ).toBe(true);
    expect(
      result.events.some((e) => e.type === "AllStarSelectionsAnnounced"),
    ).toBe(true);

    const conferenceIds = Object.keys(current.world.conferences);
    expect(conferenceIds.length).toBeGreaterThanOrEqual(2);
    for (const conferenceId of conferenceIds) {
      const picks = allStar.selections.filter(
        (s) => s.conferenceId === conferenceId,
      );
      expect(picks.filter((s) => s.role === "starter")).toHaveLength(5);
      expect(picks.filter((s) => s.role === "reserve")).toHaveLength(7);
    }
    const perTeam = new Map<string, number>();
    for (const s of allStar.selections) {
      perTeam.set(s.teamId!, (perTeam.get(s.teamId!) ?? 0) + 1);
    }
    expect(Math.max(...perTeam.values())).toBeLessThanOrEqual(3);
  });

  it("plans one all-positions ballot per conference and no midseason awards", () => {
    const { state } = bootRegularSeason("se_ballots");
    const seasonEvents = state.competition.seasonEvents;
    expect(seasonEvents.midseasonAwards).toBeNull();
    expect(
      Object.values(seasonEvents.events).some(
        (e) => e.type === "midseason_awards",
      ),
    ).toBe(false);

    const campaign = Object.values(seasonEvents.fanVoting)[0]!;
    const categories = Object.values(campaign.categories);
    const conferences = Object.values(state.world.conferences);
    expect(categories).toHaveLength(conferences.length);
    for (const category of categories) {
      expect(category.kind).toBe("open");
      const conference = state.world.conferences[category.conferenceId!]!;
      expect(category.label).toBe(`${conference.name} Conference`);
    }

    const rostered = Object.values(state.world.players).filter(
      (p) => !p.retired && p.teamId != null,
    );
    const seeded = categories.flatMap((c) => Object.keys(c.candidates));
    expect(seeded.sort()).toEqual(rostered.map((p) => p.id).sort());
  });

  it("keeps 2 starters + 2 reserves per legacy position ballot", () => {
    const { state } = bootRegularSeason("se_legacy_ballots");
    const allStar = state.competition.seasonEvents.allStar!;
    const conferenceId = Object.keys(state.world.conferences).sort()[0]!;
    const players = Object.values(state.world.players)
      .filter(
        (p) =>
          p.teamId != null &&
          state.world.teams[p.teamId]?.conferenceId === conferenceId,
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    const legacy: FanVoteCategory = {
      id: asFanVoteCategoryId(`${conferenceId}_guards`),
      label: "Guards",
      kind: "guards",
      conferenceId,
      candidates: Object.fromEntries(
        players.map((p, index) => [
          p.id,
          {
            playerId: p.id,
            teamId: p.teamId,
            voteTotal: 1_000 - index,
            voteShare: 0,
            rank: index + 1,
            previousRank: null,
          },
        ]),
      ),
    };
    const withLegacy: GameState = {
      ...state,
      competition: {
        ...state.competition,
        seasonEvents: {
          ...state.competition.seasonEvents,
          fanVoting: {
            [allStar.campaignId]: {
              ...state.competition.seasonEvents.fanVoting[allStar.campaignId]!,
              categories: { [legacy.id]: legacy },
            },
          },
        },
      },
    };

    const { allStar: selected } = finalizeAllStarSelections(
      withLegacy,
      allStar,
    );
    expect(
      selected.selections.filter((s) => s.role === "starter"),
    ).toHaveLength(2);
    expect(
      selected.selections.filter((s) => s.role === "reserve"),
    ).toHaveLength(2);
  });

  it("tournament games do not alter regular-season standings", () => {
    const { state, rng } = bootRegularSeason("se_cup");
    const tournament = state.competition.seasonEvents.tournament!;
    expect(tournament).not.toBeNull();

    // Seed some wins into standings so qualification works
    let current = state;
    const standings = { ...current.competition.standings.byTeamId };
    let i = 0;
    for (const teamId of Object.keys(standings).sort()) {
      standings[teamId] = {
        ...standings[teamId]!,
        wins: 20 - i,
        losses: i,
      };
      i += 1;
    }
    current = {
      ...current,
      competition: {
        ...current.competition,
        standings: { byTeamId: standings },
      },
    };

    const beforeStandings = JSON.stringify(current.competition.standings);
    const started = qualifyAndStartTournament(current, tournament);
    current = started.state;
    const after = current.competition.seasonEvents.tournament!;
    expect(after.status).toBe("in_progress");
    expect(after.gameIds.length).toBeGreaterThan(0);

    // Simulate tournament day
    current = {
      ...current,
      world: {
        ...current.world,
        calendar: {
          ...current.world.calendar,
          currentDate: after.startDate,
          lastSimulatedDate: addCalendarDays(after.startDate, -1),
        },
      },
    };
    const day = processSeasonEvents(current, rng);
    expect(JSON.stringify(day.state.competition.standings)).toBe(
      beforeStandings,
    );

    const tournamentGames = Object.values(day.state.competition.games).filter(
      (g) => g.competitionType === "midseason_tournament",
    );
    expect(tournamentGames.length).toBeGreaterThan(0);
    expect(
      tournamentGames.every(
        (g) => !day.state.competition.schedule.gameIds.includes(g.id),
      ),
    ).toBe(true);
  });

  it("full advance across voting window does not duplicate open events", () => {
    const { state } = bootRegularSeason("se_nodupe");
    const campaign = Object.values(
      state.competition.seasonEvents.fanVoting,
    )[0]!;

    let current: GameState = {
      ...state,
      world: {
        ...state.world,
        calendar: {
          ...state.world.calendar,
          currentDate: campaign.openDate,
          lastSimulatedDate: addCalendarDays(campaign.openDate, -1),
        },
      },
    };
    const rng = createSeededRng(current.meta.rngState);
    const first = advanceSimulation(current, rng, { days: 3 });
    current = first.state;
    const opens = first.events.filter(
      (e) => e.type === "MidseasonVotingOpened",
    );
    expect(opens.length).toBe(1);

    const second = advanceSimulation(
      current,
      createSeededRng(current.meta.rngState),
      { days: 2 },
    );
    const opensAgain = second.events.filter(
      (e) => e.type === "MidseasonVotingOpened",
    );
    expect(opensAgain.length).toBe(0);
  }, 60_000);
});
