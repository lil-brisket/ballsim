import type { GameState } from "@/state/game-state";
import {
  getExpectedPhaseWindow,
  resolveSeasonAnchors,
} from "@/systems/league-rules/league-calendar";
import { readActivePhaseId } from "@/systems/league-rules/phase-ids";
import { resolveHardLockTradeDeadlineDate } from "@/systems/league-rules/trade-rules";

export type LeagueMilestoneKey =
  | "offseasonStart"
  | "contractExpirationProcessed"
  | "rfaWindowOpen"
  | "draftStart"
  | "draftComplete"
  | "freeAgencyOpen"
  | "freeAgencyClose"
  | "preseasonStart"
  | "regularSeasonStart"
  | "tradeDeadline"
  | "regularSeasonEnd"
  | "playoffsStart"
  | "championFinalized"
  | "nextOffseason";

export type LeagueMilestone = {
  key: LeagueMilestoneKey;
  label: string;
  date: string | null;
  reached: boolean;
  active: boolean;
};

function scheduleBounds(state: GameState): {
  earliest: string | null;
  latest: string | null;
} {
  let earliest: string | null = null;
  let latest: string | null = null;
  for (const gameId of state.competition.schedule.gameIds) {
    const game = state.competition.games[gameId];
    if (!game) continue;
    if (earliest === null || game.date < earliest) earliest = game.date;
    if (latest === null || game.date > latest) latest = game.date;
  }
  return { earliest, latest };
}

/**
 * Derived league milestones from phase + snapshotted / resolved calendar dates.
 * Does not invent a second calendar engine.
 */
export function getLeagueMilestones(
  state: GameState,
): readonly LeagueMilestone[] {
  const phaseId = readActivePhaseId(state);
  const currentDate = state.world.calendar.currentDate;
  const bounds = scheduleBounds(state);
  const anchors = resolveSeasonAnchors(state);
  const seasonStart =
    state.competition.season.regularSeasonStartDate ??
    anchors.regularSeasonStart ??
    bounds.earliest;
  const deadline =
    state.competition.season.tradeDeadlineDate ??
    resolveHardLockTradeDeadlineDate(seasonStart, bounds.latest);

  const draftWindow = getExpectedPhaseWindow(state, "offseason.draft");
  const faWindow = getExpectedPhaseWindow(state, "offseason.free_agency");
  const preseasonWindow = getExpectedPhaseWindow(
    state,
    "preseason.preparation",
  );

  const draft = Object.values(state.world.drafts)[0];
  const draftComplete = draft?.status === "complete";
  const draftActive = draft?.status === "active";

  const milestones: LeagueMilestone[] = [
    {
      key: "offseasonStart",
      label: "Offseason start",
      date:
        anchors.offseasonStart ??
        state.competition.season.offseasonStageEnteredDate,
      reached:
        phaseId.startsWith("offseason.") || phaseId.startsWith("preseason."),
      active: phaseId === "offseason.season_transition",
    },
    {
      key: "rfaWindowOpen",
      label: "RFA qualifying offers",
      date: anchors.offseasonStart,
      reached:
        state.competition.season.rfaQualificationComplete === true ||
        phaseId === "offseason.free_agency" ||
        phaseId === "offseason.staff_development" ||
        phaseId === "preseason.preparation" ||
        phaseId === "regular",
      active: phaseId === "offseason.roster_decisions",
    },
    {
      key: "draftStart",
      label: "Draft",
      date: draftWindow?.start ?? null,
      reached:
        draftActive || draftComplete || phaseId === "offseason.free_agency",
      active: phaseId === "offseason.draft",
    },
    {
      key: "draftComplete",
      label: "Draft complete",
      date: draftComplete ? (draftWindow?.end ?? currentDate) : null,
      reached: draftComplete === true,
      active: false,
    },
    {
      key: "freeAgencyOpen",
      label: "Free agency open",
      date: faWindow?.start ?? null,
      reached:
        phaseId === "offseason.free_agency" ||
        phaseId === "offseason.staff_development" ||
        phaseId === "preseason.preparation" ||
        phaseId === "regular",
      active: phaseId === "offseason.free_agency",
    },
    {
      key: "freeAgencyClose",
      label: "Free agency close",
      date: faWindow?.end ?? null,
      reached:
        phaseId === "offseason.staff_development" ||
        phaseId === "preseason.preparation" ||
        phaseId === "regular",
      active: false,
    },
    {
      key: "preseasonStart",
      label: "Preseason",
      date: preseasonWindow?.start ?? anchors.preseasonStart,
      reached:
        phaseId === "preseason.preparation" ||
        phaseId === "regular" ||
        phaseId === "playoffs",
      active: phaseId === "preseason.preparation",
    },
    {
      key: "regularSeasonStart",
      label: "Regular season start",
      date: seasonStart,
      reached:
        phaseId === "regular" ||
        phaseId === "playoffs" ||
        phaseId === "postseason.season_review",
      active: phaseId === "regular",
    },
    {
      key: "tradeDeadline",
      label: "Trade deadline",
      date: deadline,
      reached:
        deadline !== null &&
        currentDate >= deadline &&
        (phaseId === "regular" ||
          phaseId === "playoffs" ||
          phaseId === "postseason.season_review"),
      active:
        phaseId === "regular" && deadline !== null && currentDate < deadline,
    },
    {
      key: "regularSeasonEnd",
      label: "Regular season end",
      date: anchors.regularSeasonEnd ?? bounds.latest,
      reached: phaseId === "playoffs" || phaseId === "postseason.season_review",
      active: false,
    },
    {
      key: "playoffsStart",
      label: "Playoffs",
      date: anchors.regularSeasonEnd,
      reached:
        phaseId === "playoffs" || phaseId === "postseason.season_review",
      active: phaseId === "playoffs",
    },
    {
      key: "championFinalized",
      label: "Champion determined",
      date: anchors.playoffsEnd,
      reached:
        phaseId === "postseason.season_review" ||
        phaseId.startsWith("offseason."),
      active: phaseId === "postseason.season_review",
    },
    {
      key: "nextOffseason",
      label: "Next offseason",
      date: null,
      reached: false,
      active: false,
    },
  ];

  return milestones;
}
