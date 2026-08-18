import {
  createOwnerObjective,
  type OwnerObjective,
  type OwnerObjectiveRole,
  type OwnerObjectiveType,
} from "@/domain/entities/owner-objective";
import { asOwnerObjectiveId, type TeamId } from "@/domain/ids";
import { systemResult, type SystemResult } from "@/domain/system-result";
import type { GameState } from "@/state/game-state";
import { calculateFranchiseValue } from "@/state/franchise-value";
import {
  meanRosterOverall,
  meanYoungRosterOverall,
  youngRosterSharePct,
} from "@/state/roster-strength";
import {
  evaluateOwnerObjectiveMetric,
  getOwnerObjectiveDefinition,
  countCareerChampionships,
  countCareerPlayoffAppearances,
} from "@/systems/owner-objective-definitions";
import {
  OWNER_OBJECTIVE_CAREER_CHAMPIONSHIPS,
  OWNER_OBJECTIVE_CAREER_PLAYOFFS,
  OWNER_OBJECTIVE_MID_OVERALL,
  OWNER_OBJECTIVE_MULTI_SEASON_HORIZON,
  OWNER_OBJECTIVE_PAYROLL_LIMIT,
  OWNER_OBJECTIVE_SMALL_MARKET,
  OWNER_OBJECTIVE_STRONG_OVERALL,
  OWNER_OBJECTIVE_VALUE_GROWTH_PCT,
  OWNER_OBJECTIVE_WIN_TARGET_MID,
  OWNER_OBJECTIVE_WIN_TARGET_WEAK,
  OWNER_OBJECTIVE_YOUNG_SHARE_TARGET,
  OWNER_OBJECTIVE_YOUTH_OVERALL_GAIN,
} from "@/systems/owner-objectives-config";
import {
  clampOwnerPatience,
  getOwnerPhilosophyProfile,
  OWNER_PATIENCE_COMPLETE_DELTA,
  OWNER_PATIENCE_FAIL_DELTA,
  OWNER_PATIENCE_PRIMARY_FAIL_EXTRA,
  OWNER_PATIENCE_TIGHTEN_THRESHOLD,
  OWNER_PATIENCE_TIGHTEN_WIN_FACTOR,
  type OwnerPhilosophyProfile,
} from "@/systems/owner-philosophy-config";
import { getFinancialStatement, getNetIncome } from "@/systems/team-finances";
import { getTeamPayroll } from "@/systems/salary-cap";

/**
 * Creates mandate objectives for the controlled team when gaps exist.
 * Idempotent for the same seasonYear / active long-term set.
 */
export function generateOwnerObjectives(state: GameState): SystemResult {
  const seasonYear = state.competition.season.year;
  const teamId = state.user.controlledTeamId;
  const profile = getOwnerPhilosophyProfile(state.user.ownerPhilosophy);
  const generated: OwnerObjective[] = [];

  const hasSeasonalForYear = state.user.objectives.some(
    (objective) =>
      objective.lifecycle === "seasonal" &&
      objective.seasonYear === seasonYear,
  );

  if (!hasSeasonalForYear) {
    generated.push(
      ...buildSeasonalObjectives(state, teamId, seasonYear, profile),
    );
  }

  const hasLongTermActive = state.user.objectives.some(
    (objective) =>
      (objective.lifecycle === "career" ||
        objective.lifecycle === "multi_season" ||
        objective.role === "long_term") &&
      objective.status === "active",
  );

  if (!hasLongTermActive) {
    const longTerm = buildLongTermObjective(state, teamId, seasonYear, profile);
    if (
      longTerm &&
      !state.user.objectives.some((objective) => objective.id === longTerm.id) &&
      !generated.some((objective) => objective.id === longTerm.id)
    ) {
      generated.push(longTerm);
    }
  }

  const hasOpenMilestone = state.user.objectives.some(
    (objective) =>
      objective.lifecycle === "milestone" && objective.status === "active",
  );
  if (!hasOpenMilestone) {
    const milestone = buildMilestoneObjective(state, teamId, seasonYear);
    if (
      milestone &&
      !state.user.objectives.some((objective) => objective.id === milestone.id) &&
      !generated.some((objective) => objective.id === milestone.id)
    ) {
      generated.push(milestone);
    }
  }

  if (generated.length === 0) {
    return systemResult(state);
  }

  return systemResult({
    ...state,
    user: {
      ...state.user,
      objectives: [...state.user.objectives, ...generated],
    },
  });
}

/**
 * Evaluates active owner objectives from canonical simulation state.
 * Sticky completed/failed statuses are not rewritten.
 * Generates mandate objectives when seasonal/long-term gaps exist.
 * Applies owner patience deltas for newly resolved seasonal primary/secondary.
 */
export function evaluateOwnerObjectives(state: GameState): SystemResult {
  let current = state;
  const generated = generateOwnerObjectives(current);
  current = generated.state;

  const teamId = current.user.controlledTeamId;
  const seasonYear = current.competition.season.year;
  const previous = current.user.objectives;
  const nextObjectives = previous.map((objective) =>
    evaluateOne(objective, current, teamId, seasonYear),
  );

  let ownerPatience = current.user.ownerPatience;
  for (let index = 0; index < nextObjectives.length; index += 1) {
    const before = previous[index]!;
    const after = nextObjectives[index]!;
    if (before.status === "active" && after.status !== "active") {
      ownerPatience = applyPatienceDelta(ownerPatience, after);
    }
  }

  const objectivesChanged = nextObjectives.some(
    (objective, index) => objective !== previous[index],
  );
  const patienceChanged = ownerPatience !== current.user.ownerPatience;
  if (!objectivesChanged && !patienceChanged) {
    return systemResult(current);
  }

  return systemResult({
    ...current,
    user: {
      ...current.user,
      objectives: nextObjectives,
      ownerPatience: clampOwnerPatience(ownerPatience),
    },
  });
}

/**
 * Season-boundary resolution for objectives that remain active when the
 * competition phase can no longer satisfy them.
 */
export function resolveSeasonObjectives(state: GameState): SystemResult {
  return evaluateOwnerObjectives(state);
}

function applyPatienceDelta(
  patience: number,
  objective: OwnerObjective,
): number {
  if (
    objective.lifecycle !== "seasonal" ||
    (objective.role !== "primary" && objective.role !== "secondary")
  ) {
    return patience;
  }
  if (objective.status === "completed") {
    return clampOwnerPatience(patience + OWNER_PATIENCE_COMPLETE_DELTA);
  }
  if (objective.status === "failed") {
    let delta = OWNER_PATIENCE_FAIL_DELTA;
    if (objective.role === "primary") {
      delta += OWNER_PATIENCE_PRIMARY_FAIL_EXTRA;
    }
    return clampOwnerPatience(patience + delta);
  }
  return patience;
}

function evaluateOne(
  objective: OwnerObjective,
  state: GameState,
  teamId: TeamId,
  seasonYear: number,
): OwnerObjective {
  if (objective.status !== "active") {
    return objective;
  }

  if (objective.lifecycle === "seasonal" && objective.seasonYear !== seasonYear) {
    return objective;
  }

  return evaluateOwnerObjectiveMetric(objective, state, teamId, seasonYear);
}

function buildSeasonalObjectives(
  state: GameState,
  teamId: TeamId,
  seasonYear: number,
  profile: OwnerPhilosophyProfile,
): OwnerObjective[] {
  const meanOverall = meanRosterOverall(state, teamId);
  const ops = state.business.franchiseOps[teamId];
  const marketSize = ops?.marketSize ?? 50;
  const usedTypes = new Set<OwnerObjectiveType>();
  const results: OwnerObjective[] = [];

  const primaryType = pickPrimaryType(
    profile,
    meanOverall,
    marketSize,
    state,
    teamId,
  );
  usedTypes.add(primaryType);
  results.push(
    createTypedObjective({
      state,
      teamId,
      seasonYear,
      type: primaryType,
      role: "primary",
      profile,
    }),
  );

  const secondaryTypes = pickSecondaryTypes(
    profile,
    primaryType,
    meanOverall,
    marketSize,
    usedTypes,
  );
  for (const type of secondaryTypes) {
    usedTypes.add(type);
    results.push(
      createTypedObjective({
        state,
        teamId,
        seasonYear,
        type,
        role: "secondary",
        profile,
      }),
    );
  }

  return results;
}

function pickPrimaryType(
  profile: OwnerPhilosophyProfile,
  meanOverall: number,
  marketSize: number,
  state: GameState,
  teamId: TeamId,
): OwnerObjectiveType {
  const cash = state.business.finances[teamId]?.cash ?? 0;
  if (profile.philosophy === "market_expansion" && marketSize <= OWNER_OBJECTIVE_SMALL_MARKET) {
    return firstAvailable(profile.preferredPrimary, [
      "attendance",
      "fan_sentiment",
      "awareness",
    ]);
  }
  if (profile.philosophy === "financially_conservative" || (profile.requiresProfitability && cash < 5_000_000)) {
    return firstAvailable(profile.preferredPrimary, [
      "improve_finances",
      "positive_cash",
      "payroll_limit",
    ]);
  }
  if (profile.philosophy === "build_for_the_future" && meanOverall < OWNER_OBJECTIVE_MID_OVERALL) {
    return firstAvailable(profile.preferredPrimary, [
      "develop_young_players",
      "roster_direction",
      "minimum_win_total",
    ]);
  }
  if (meanOverall >= OWNER_OBJECTIVE_STRONG_OVERALL) {
    return firstAvailable(profile.preferredPrimary, [
      "make_playoffs",
      "win_championship",
      "minimum_win_total",
    ]);
  }
  return firstAvailable(profile.preferredPrimary, [
    "minimum_win_total",
    "make_playoffs",
    "improve_finances",
  ]);
}

function pickSecondaryTypes(
  profile: OwnerPhilosophyProfile,
  primaryType: OwnerObjectiveType,
  meanOverall: number,
  marketSize: number,
  used: Set<OwnerObjectiveType>,
): OwnerObjectiveType[] {
  const picks: OwnerObjectiveType[] = [];
  const candidates = [...profile.preferredSecondary];

  if (profile.payrollPressure >= 0.5 && !used.has("payroll_limit") && primaryType !== "payroll_limit") {
    candidates.unshift("payroll_limit");
  }
  if (
    profile.philosophy === "market_expansion" &&
    marketSize <= OWNER_OBJECTIVE_SMALL_MARKET
  ) {
    candidates.unshift("awareness", "fan_sentiment");
  }
  if (
    profile.philosophy === "build_for_the_future" &&
    meanOverall < OWNER_OBJECTIVE_MID_OVERALL
  ) {
    candidates.unshift("roster_direction");
  }

  for (const type of candidates) {
    if (used.has(type) || type === primaryType) {
      continue;
    }
    picks.push(type);
    if (picks.length >= 2) {
      break;
    }
  }

  if (picks.length === 0 && primaryType !== "payroll_limit") {
    picks.push("payroll_limit");
  }
  return picks;
}

function firstAvailable(
  preferred: readonly OwnerObjectiveType[],
  fallbacks: readonly OwnerObjectiveType[],
): OwnerObjectiveType {
  for (const type of preferred) {
    return type;
  }
  return fallbacks[0] ?? "minimum_win_total";
}

function buildLongTermObjective(
  state: GameState,
  teamId: TeamId,
  seasonYear: number,
  profile: OwnerPhilosophyProfile,
): OwnerObjective | null {
  const type =
    profile.preferredLongTerm[0] ??
    ("franchise_value" as OwnerObjectiveType);
  return createTypedObjective({
    state,
    teamId,
    seasonYear,
    type,
    role: "long_term",
    profile,
    forceLifecycle:
      type === "championship_count" || type === "playoff_count"
        ? "career"
        : "multi_season",
  });
}

function buildMilestoneObjective(
  state: GameState,
  teamId: TeamId,
  seasonYear: number,
): OwnerObjective | null {
  const history = state.business.franchiseHistory[teamId];
  const hadPlayoffs =
    history?.seasons.some((season) => season.playoffResult !== "missed") ??
    false;
  const hadTitle =
    history?.seasons.some((season) => season.championship) ?? false;
  const arenaLevel =
    state.business.franchiseOps[teamId]?.facilities.arena.level ?? 1;

  const completedMilestoneTypes = new Set(
    state.user.objectives
      .filter(
        (objective) =>
          objective.lifecycle === "milestone" &&
          objective.status === "completed",
      )
      .map((objective) => objective.type),
  );

  if (!hadPlayoffs && !completedMilestoneTypes.has("make_playoffs")) {
    return createOwnerObjective({
      id: asOwnerObjectiveId(`obj_milestone_first_playoffs`),
      type: "make_playoffs",
      description: "Reach the playoffs for the first time",
      status: "active",
      seasonYear,
      category: "competitive",
      lifecycle: "milestone",
      role: "long_term",
      progress: 0,
      consequenceApplied: false,
    });
  }

  if (!hadTitle && !completedMilestoneTypes.has("win_championship")) {
    return createOwnerObjective({
      id: asOwnerObjectiveId(`obj_milestone_first_title`),
      type: "win_championship",
      description: "Win the franchise's first championship",
      status: "active",
      seasonYear,
      category: "competitive",
      lifecycle: "milestone",
      role: "long_term",
      progress: 0,
      consequenceApplied: false,
    });
  }

  if (arenaLevel < 5 && !completedMilestoneTypes.has("arena_level")) {
    return createOwnerObjective({
      id: asOwnerObjectiveId(`obj_milestone_arena_${arenaLevel + 1}`),
      type: "arena_level",
      description: `Upgrade the arena to level ${arenaLevel + 1}`,
      status: "active",
      seasonYear,
      category: "franchise",
      lifecycle: "milestone",
      role: "long_term",
      target: arenaLevel + 1,
      baseline: arenaLevel,
      progress: arenaLevel,
      consequenceApplied: false,
    });
  }

  return null;
}

type CreateTypedArgs = {
  state: GameState;
  teamId: TeamId;
  seasonYear: number;
  type: OwnerObjectiveType;
  role: OwnerObjectiveRole;
  profile: OwnerPhilosophyProfile;
  forceLifecycle?: OwnerObjective["lifecycle"];
};

function createTypedObjective(args: CreateTypedArgs): OwnerObjective {
  const { state, teamId, seasonYear, type, role, profile } = args;
  const definition = getOwnerObjectiveDefinition(type);
  const lifecycle = args.forceLifecycle ?? definition.defaultLifecycle;
  const baseId = `obj_${seasonYear}_${role}_${type}`;

  switch (type) {
    case "make_playoffs":
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: "Make the playoffs",
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        progress: 0,
        consequenceApplied: false,
      });
    case "minimum_win_total": {
      const target = winTargetForProfile(state, teamId, profile);
      return createOwnerObjective({
        id: asOwnerObjectiveId(`${baseId}_${target}`),
        type,
        description: `Win at least ${target} games`,
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        target,
        progress: 0,
        consequenceApplied: false,
      });
    }
    case "payroll_limit": {
      const target = payrollTargetForProfile(profile);
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: `Keep payroll at or below ${target}`,
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        target,
        progress: getTeamPayroll(teamId, seasonYear, state),
        consequenceApplied: false,
      });
    }
    case "improve_finances":
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: "Finish the season with a profit",
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        progress: Math.max(0, getNetIncome(state, teamId, seasonYear)),
        consequenceApplied: false,
      });
    case "positive_cash":
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: "Maintain positive cash through the season",
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        progress: Math.max(0, state.business.finances[teamId]?.cash ?? 0),
        consequenceApplied: false,
      });
    case "revenue_target": {
      const statement = getFinancialStatement(state, teamId, seasonYear);
      const target = Math.max(
        20_000_000,
        Math.round(statement.revenue.total * 1.1) || 40_000_000,
      );
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: `Reach ${target} in season revenue`,
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        target,
        progress: statement.revenue.total,
        consequenceApplied: false,
      });
    }
    case "win_championship":
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: "Win the championship",
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        progress: 0,
        consequenceApplied: false,
      });
    case "playoff_round":
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: "Reach the conference finals",
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        target: 2,
        progress: 0,
        consequenceApplied: false,
      });
    case "playoff_seed":
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: "Finish as a top-4 playoff seed",
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        target: 4,
        progress: 0,
        consequenceApplied: false,
      });
    case "develop_young_players": {
      const baseline = meanYoungRosterOverall(state, teamId);
      const target = Math.round(baseline + OWNER_OBJECTIVE_YOUTH_OVERALL_GAIN);
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: `Raise young-player overall to ${target}`,
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        target,
        baseline,
        progress: baseline,
        consequenceApplied: false,
      });
    }
    case "roster_direction":
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: `Keep at least ${OWNER_OBJECTIVE_YOUNG_SHARE_TARGET}% of the roster young`,
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        target: OWNER_OBJECTIVE_YOUNG_SHARE_TARGET,
        progress: youngRosterSharePct(state, teamId),
        consequenceApplied: false,
      });
    case "attendance": {
      const target = profile.attendanceFloorPct;
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: `Reach ${target}% arena fill rate`,
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        target,
        progress: 0,
        consequenceApplied: false,
      });
    }
    case "fan_sentiment": {
      const target = profile.sentimentFloor;
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: `Raise fan sentiment to ${target}`,
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        target,
        progress: state.business.franchiseOps[teamId]?.fanSentiment ?? 0,
        consequenceApplied: false,
      });
    }
    case "awareness": {
      const target = profile.awarenessFloor;
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: `Raise market awareness to ${target}`,
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        target,
        progress:
          state.business.franchiseOps[teamId]?.marketing.awareness ?? 0,
        consequenceApplied: false,
      });
    }
    case "reputation": {
      const target = Math.max(
        55,
        (state.world.teams[teamId]?.reputation ?? 50) + 5,
      );
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: `Raise franchise reputation to ${target}`,
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        target,
        progress: state.world.teams[teamId]?.reputation ?? 0,
        consequenceApplied: false,
      });
    }
    case "arena_level": {
      const level =
        state.business.franchiseOps[teamId]?.facilities.arena.level ?? 1;
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: `Upgrade the arena to level ${level + 1}`,
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle: "milestone",
        role,
        target: level + 1,
        baseline: level,
        progress: level,
        consequenceApplied: false,
      });
    }
    case "franchise_value": {
      const baseline = calculateFranchiseValue(state, teamId);
      const target = Math.round(
        baseline * (1 + OWNER_OBJECTIVE_VALUE_GROWTH_PCT / 100),
      );
      return createOwnerObjective({
        id: asOwnerObjectiveId(baseId),
        type,
        description: `Grow franchise value by ${OWNER_OBJECTIVE_VALUE_GROWTH_PCT}%`,
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle,
        role,
        target,
        baseline,
        horizonYears:
          lifecycle === "multi_season"
            ? OWNER_OBJECTIVE_MULTI_SEASON_HORIZON
            : undefined,
        progress: baseline,
        consequenceApplied: false,
      });
    }
    case "championship_count": {
      const progress = countCareerChampionships(state, teamId);
      return createOwnerObjective({
        id: asOwnerObjectiveId(`obj_career_championships`),
        type,
        description: `Win ${OWNER_OBJECTIVE_CAREER_CHAMPIONSHIPS} championships`,
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle: "career",
        role,
        target: OWNER_OBJECTIVE_CAREER_CHAMPIONSHIPS,
        progress,
        consequenceApplied: false,
      });
    }
    case "playoff_count": {
      const progress = countCareerPlayoffAppearances(state, teamId);
      return createOwnerObjective({
        id: asOwnerObjectiveId(`obj_career_playoffs`),
        type,
        description: `Make the playoffs ${OWNER_OBJECTIVE_CAREER_PLAYOFFS} times`,
        status: "active",
        seasonYear,
        category: definition.category,
        lifecycle: "career",
        role,
        target: OWNER_OBJECTIVE_CAREER_PLAYOFFS,
        progress,
        consequenceApplied: false,
      });
    }
  }
}

function winTargetForProfile(
  state: GameState,
  teamId: TeamId,
  profile: OwnerPhilosophyProfile,
): number {
  const meanOverall = meanRosterOverall(state, teamId);
  let target: number;
  if (meanOverall >= OWNER_OBJECTIVE_STRONG_OVERALL) {
    target = profile.winTolerance.strong;
  } else if (meanOverall >= OWNER_OBJECTIVE_MID_OVERALL) {
    target = Math.max(
      profile.winTolerance.acceptable,
      OWNER_OBJECTIVE_WIN_TARGET_MID,
    );
  } else {
    target = Math.max(
      profile.winTolerance.acceptable,
      OWNER_OBJECTIVE_WIN_TARGET_WEAK,
    );
    if (profile.philosophy === "build_for_the_future") {
      target = profile.winTolerance.acceptable;
    }
  }

  if (state.user.ownerPatience < OWNER_PATIENCE_TIGHTEN_THRESHOLD) {
    target = Math.round(target * OWNER_PATIENCE_TIGHTEN_WIN_FACTOR);
  }
  return target;
}

function payrollTargetForProfile(profile: OwnerPhilosophyProfile): number {
  const pressure = profile.payrollPressure;
  const fraction = 1.15 - pressure * 0.25;
  return Math.round(OWNER_OBJECTIVE_PAYROLL_LIMIT * fraction);
}
