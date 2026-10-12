from pathlib import Path
import re

path = Path(r"c:\Users\dynam\Documents\Basketball\src\application\game-service.ts")
text = path.read_text(encoding="utf-8")

old_type_start = text.find("export type CalendarPageMediaHighlight")
load_start = text.find("export async function loadCalendarPageView")
next_fn = text.find("\nexport async function ", load_start + 10)
assert min(old_type_start, load_start, next_fn) > 0

new_block = r'''export type CalendarPageMediaHighlight = {
  date: string;
  headline: string;
  summary: string;
  storyType: string;
};

export type CalendarPageView = {
  save: SaveGameSummary;
  dashboard: DashboardSnapshot;
  currentDate: string;
  year: number;
  month: number;
  selectedDate: string;
  monthGrid: CalendarMonthGrid;
  inspector: import("@/systems/calendar/calendar-inspector").CalendarDateInspectorView;
  leagueContext: import("@/state/standings-selectors").CalendarLeagueContextView | null;
  nextTeamGameDate: string | null;
  timeDisabled: boolean;
  timeDisabledFlags: {
    userOnDraftClock: boolean;
    seasonReviewPending: boolean;
    pendingOwnerDecision: boolean;
  };
  recentMediaHighlights: CalendarPageMediaHighlight[];
  userTeamId: TeamId;
  pauseBanner: {
    reason: "draft_clock" | "owner_decision" | null;
    message: string | null;
    resolveHref: string | null;
  };
  simulationSummary: import("@/systems/calendar/simulation-summary").SimulationSummary | null;
};

export type LoadCalendarPageViewOptions = {
  year?: number;
  month?: number;
  selectedDate?: string;
  /** When set with daysAdvanced, rebuilds a team-first simulation summary. */
  simulationFromDate?: string;
  daysAdvanced?: number;
};

/**
 * Calendar page data: owner-scoped month grid, date inspector, league context.
 * Loads GameState once; does not invent projected trades or injuries.
 */
export async function loadCalendarPageView(
  saveId: string,
  options: LoadCalendarPageViewOptions = {},
  store?: SaveGameStore,
): Promise<CalendarPageView | null> {
  const loaded = await getStore(store).load(saveId);
  if (!loaded) {
    return null;
  }

  const state = loaded.state;
  const currentDate = state.world.calendar.currentDate;
  const parsedCurrent = parseCalendarDate(currentDate);

  const year =
    options.year !== undefined && Number.isInteger(options.year)
      ? options.year
      : parsedCurrent.year;
  const month =
    options.month !== undefined &&
    Number.isInteger(options.month) &&
    options.month >= 1 &&
    options.month <= 12
      ? options.month
      : parsedCurrent.month;

  const selectedDate =
    options.selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(options.selectedDate)
      ? options.selectedDate
      : currentDate;

  const teamId = state.user.activeOwnerTeamId;
  const monthGrid = getCalendarMonthGrid(state, year, month, {
    saveId,
    teamId,
  });
  const inspector = buildCalendarDateInspectorView(state, selectedDate, {
    saveId,
  });
  const leagueContext = toCalendarLeagueContext(state);
  const nextTeamGameDate = getNextTeamGameDate(state, teamId);

  const ownerDash = toOwnerDashboardView(state);
  const timeDisabledFlags = {
    userOnDraftClock: ownerDash.flags.userOnDraftClock,
    seasonReviewPending: ownerDash.flags.seasonReviewPending,
    pendingOwnerDecision: ownerDash.flags.pendingOwnerDecision,
  };

  const franchise = getActiveOwnedFranchise(state);
  const recentMediaHighlights: CalendarPageMediaHighlight[] = (
    franchise.mediaFeed?.items ?? []
  )
    .slice(0, 40)
    .map((item) => ({
      date: item.occurredOn,
      headline: item.headline,
      summary: item.summary,
      storyType: item.storyType,
    }));

  return {
    save: toSaveSummary(loaded),
    dashboard: toDashboardSnapshot(state),
    currentDate,
    year,
    month,
    selectedDate,
    monthGrid,
    inspector,
    leagueContext,
    nextTeamGameDate,
    timeDisabled:
      timeDisabledFlags.userOnDraftClock ||
      timeDisabledFlags.pendingOwnerDecision,
    timeDisabledFlags,
    recentMediaHighlights,
    userTeamId: teamId,
    pauseBanner: timeDisabledFlags.userOnDraftClock
      ? {
          reason: "draft_clock" as const,
          message: "Simulation paused — your team is on the draft clock.",
          resolveHref: `/dashboard/${saveId}/draft`,
        }
      : timeDisabledFlags.pendingOwnerDecision
        ? {
            reason: "owner_decision" as const,
            message:
              "Simulation paused — a required owner decision must be resolved.",
            resolveHref: `/dashboard/${saveId}`,
          }
        : { reason: null, message: null, resolveHref: null },
    simulationSummary: (() => {
      const daysAdvanced = options.daysAdvanced;
      if (
        daysAdvanced == null ||
        !Number.isInteger(daysAdvanced) ||
        daysAdvanced < 1
      ) {
        return null;
      }
      const fromDate =
        options.simulationFromDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(options.simulationFromDate)
          ? options.simulationFromDate
          : addCalendarDays(currentDate, -daysAdvanced);
      return buildSimulationSummary(state, [], {
        fromDate,
        toDate: currentDate,
      });
    })(),
  };
}
'''

new_text = text[:old_type_start] + new_block + text[next_fn:]

# Patch calendar import
m = re.search(
    r'import \{\n(?P<body>.*?)\n\} from "@/systems/calendar";',
    new_text,
    re.S,
)
assert m, "calendar import not found"
lines = m.group("body").splitlines()
joined = "\n".join(lines)
for symbol in ("buildCalendarDateInspectorView", "getNextTeamGameDate"):
    if symbol not in joined:
        lines.insert(0, f"  {symbol},")
new_text = (
    new_text[: m.start()]
    + "import {\n"
    + "\n".join(lines)
    + '\n} from "@/systems/calendar";'
    + new_text[m.end() :]
)

# League context import
prefix = new_text[: new_text.find("export async function loadCalendarPageView")]
if "toCalendarLeagueContext" not in prefix:
    sm = re.search(
        r'import \{([^}]*)\} from "@/state/standings-selectors";',
        new_text,
        re.S,
    )
    if sm and "toCalendarLeagueContext" not in sm.group(1):
        body = sm.group(1).rstrip().rstrip(",") + ",\n  toCalendarLeagueContext,\n"
        new_text = (
            new_text[: sm.start()]
            + f'import {{{body}}} from "@/state/standings-selectors";'
            + new_text[sm.end() :]
        )
    elif not sm:
        insert_at = new_text.find('} from "@/systems/calendar";') + len(
            '} from "@/systems/calendar";'
        )
        new_text = (
            new_text[:insert_at]
            + '\nimport { toCalendarLeagueContext } from "@/state/standings-selectors";'
            + new_text[insert_at:]
        )

# Drop unused getTeamGameForDate import if only referenced once (the import itself)
if re.search(
    r'import \{ getTeamGameForDate \} from "@/systems/calendar/schedule-projection";\n',
    new_text,
) and len(re.findall(r"\bgetTeamGameForDate\b", new_text)) <= 1:
    new_text = re.sub(
        r'\nimport \{ getTeamGameForDate \} from "@/systems/calendar/schedule-projection";\n',
        "\n",
        new_text,
        count=1,
    )

path.write_text(new_text, encoding="utf-8")
print("Patched game-service.ts")
