/**
 * Today operational briefing — distinct from month planning view.
 */

import type { CalendarEventView } from "@/domain/entities/calendar-event";
import type { TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import {
  projectCalendarEvents,
  teamDisplayName,
} from "@/systems/calendar/project-calendar-events";

export type CalendarTodayYourTeamBriefing = {
  teamId: TeamId;
  teamName: string;
  games: CalendarEventView[];
  injuries: CalendarEventView[];
  other: CalendarEventView[];
};

export type CalendarTodayLeagueBriefing = {
  gamesScheduled: number;
  notableTransactions: CalendarEventView[];
  deadlines: CalendarEventView[];
  other: CalendarEventView[];
};

export type CalendarTodayBriefing = {
  date: string;
  yourTeam: CalendarTodayYourTeamBriefing;
  league: CalendarTodayLeagueBriefing;
  actionRequired: CalendarEventView[];
};

export function getCalendarTodayBriefing(
  state: GameState,
): CalendarTodayBriefing {
  const date = state.world.calendar.currentDate;
  const teamId = state.user.activeOwnerTeamId;
  const teamName = teamDisplayName(state, teamId);

  const todayEvents = projectCalendarEvents(state, {
    from: date,
    to: date,
  });

  const actionRequired = todayEvents.filter(
    (event) => event.lifecycle === "action_required" || event.blocking,
  );
  const actionKeys = new Set(actionRequired.map((event) => event.sourceKey));

  const remainder = todayEvents.filter(
    (event) => !actionKeys.has(event.sourceKey),
  );
  const yourTeamEvents = remainder.filter(
    (event) => event.teamIds?.includes(teamId) === true,
  );
  const leagueEvents = remainder.filter(
    (event) => event.teamIds?.includes(teamId) !== true,
  );

  const yourTeamGames = yourTeamEvents.filter(
    (event) => event.category === "game",
  );
  const yourTeamInjuries = yourTeamEvents.filter(
    (event) => event.category === "injury",
  );
  const yourTeamOther = yourTeamEvents.filter(
    (event) => event.category !== "game" && event.category !== "injury",
  );

  const leagueGames = leagueEvents.filter((event) => event.category === "game");
  const notableTransactions = leagueEvents.filter(
    (event) =>
      event.category === "transaction" &&
      (event.importance === "critical" || event.importance === "high"),
  );
  const deadlines = leagueEvents.filter(
    (event) => event.category === "deadline",
  );
  const leagueOther = leagueEvents.filter(
    (event) =>
      event.category !== "game" &&
      event.category !== "transaction" &&
      event.category !== "deadline",
  );

  return {
    date,
    yourTeam: {
      teamId,
      teamName,
      games: yourTeamGames,
      injuries: yourTeamInjuries,
      other: yourTeamOther,
    },
    league: {
      gamesScheduled: leagueGames.length + yourTeamGames.length,
      notableTransactions,
      deadlines,
      other: leagueOther,
    },
    actionRequired,
  };
}
