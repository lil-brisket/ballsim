/**
 * Data-driven fantasy draft analysis — facts first, template narratives second.
 */

import type {
  FantasyDraftLeagueAward,
  FantasyDraftLeagueRecap,
  FantasyDraftPickAnalysis,
  FantasyDraftPickAssessment,
  FantasyDraftPickBreakdownRow,
  FantasyDraftPickHighlight,
  FantasyDraftPositionBalance,
  FantasyDraftPositionBalanceLevel,
  FantasyDraftTeamSummary,
} from "@/domain/entities/fantasy-draft";
import type { Player, PlayerPosition } from "@/domain/entities/player";
import { PLAYER_POSITIONS } from "@/domain/entities/player";
import { ARCHETYPE_LABELS } from "@/domain/entities/player-archetype";
import { calculatePlayerOverall } from "@/domain/player-overall-rating";
import type { PlayerId, TeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { calculateTeamDraftNeeds } from "@/systems/draft/draft-needs";
import {
  applyRosterNeedModifiers,
  draftTalentScore,
  fantasyDraftPositionCounts,
} from "@/systems/fantasy-draft/draft-evaluation";
import { resolveFranchisePreferences } from "@/systems/franchise-ai-preferences";

const GRADE_ORDER = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D",
  "F",
] as const;

function letterFromScore(score: number): string {
  if (score >= 92) return "A+";
  if (score >= 88) return "A";
  if (score >= 84) return "A-";
  if (score >= 80) return "B+";
  if (score >= 76) return "B";
  if (score >= 72) return "B-";
  if (score >= 68) return "C+";
  if (score >= 64) return "C";
  if (score >= 58) return "C-";
  if (score >= 50) return "D";
  return "F";
}

function gradeLabel(grade: string): string {
  if (grade.startsWith("A")) return "Excellent draft";
  if (grade.startsWith("B")) return "Solid draft";
  if (grade.startsWith("C")) return "Average draft";
  if (grade === "D") return "Below-average draft";
  return "Weak draft";
}

function valueStarsFromTalentRank(talentRank: number, pickNumber: number): number {
  const expectedRank = Math.max(1, Math.round(pickNumber * 0.85));
  const delta = expectedRank - talentRank;
  if (delta >= 12) return 5;
  if (delta >= 5) return 4;
  if (delta >= -2) return 3;
  if (delta >= -10) return 2;
  return 1;
}

function assessmentFromStars(
  stars: number,
  reachDelta: number,
): FantasyDraftPickAssessment {
  if (reachDelta >= 15) return "Reach";
  if (stars >= 5) return "Excellent";
  if (stars >= 4) return "Strong";
  if (stars >= 3) return "Good";
  return "Fair";
}

function balanceLevel(
  count: number,
  avgOvr: number | null,
): FantasyDraftPositionBalanceLevel {
  if (count === 0) return "Weak";
  if (count >= 3 && (avgOvr ?? 0) >= 80) return "Excellent";
  if (count >= 2 && (avgOvr ?? 0) >= 76) return "Good";
  if (count >= 2 || (avgOvr ?? 0) >= 74) return "Average";
  if (count === 1 && (avgOvr ?? 0) >= 72) return "Below Average";
  return "Weak";
}

function highlightFromPlayer(
  player: Player,
  pickNumber: number,
): FantasyDraftPickHighlight {
  return {
    playerId: player.id,
    playerName: `${player.firstName} ${player.lastName}`,
    pickNumber,
    overall: calculatePlayerOverall(player.position, player.attributes),
    potential: player.potential.overall,
    position: player.position,
  };
}

export function analyzeFantasyDraftPicks(
  state: GameState,
): FantasyDraftPickAnalysis[] {
  const draft = state.world.fantasyDraft;
  if (draft === null) return [];

  const prefsByTeam = new Map<
    string,
    ReturnType<typeof resolveFranchisePreferences>
  >();
  for (const teamId of draft.draftOrder) {
    prefsByTeam.set(
      teamId,
      resolveFranchisePreferences(state, teamId),
    );
  }

  const talentScoreByPlayer = new Map<string, number>();
  for (const playerId of draft.poolPlayerIds) {
    const player = state.world.players[playerId];
    if (!player) continue;
    // Neutral talent score (no franchise prefs) for league-comparable ranks
    talentScoreByPlayer.set(String(playerId), draftTalentScore(player, undefined));
  }

  const taken = new Set<string>();
  const rosterCounts = new Map<string, Map<PlayerPosition, number>>();
  for (const teamId of draft.draftOrder) {
    const counts = new Map<PlayerPosition, number>();
    for (const position of PLAYER_POSITIONS) {
      counts.set(position, 0);
    }
    rosterCounts.set(teamId, counts);
  }

  const analyses: FantasyDraftPickAnalysis[] = [];

  for (const selection of draft.selections) {
    const prefs = prefsByTeam.get(selection.teamId)?.preferences;
    const counts = rosterCounts.get(selection.teamId)!;

    const availableIds: string[] = [];
    for (const playerId of draft.poolPlayerIds) {
      const key = String(playerId);
      if (taken.has(key)) continue;
      if (!state.world.players[playerId]) continue;
      availableIds.push(key);
    }

    const selectedKey = String(selection.playerId);
    const selectedPlayer = state.world.players[selection.playerId];
    if (!selectedPlayer) {
      taken.add(selectedKey);
      analyses.push({
        pickNumber: selection.pickNumber,
        teamId: selection.teamId,
        playerId: selection.playerId,
        talentRankAtPick: availableIds.length,
        fitRankAtPick: availableIds.length,
        wasBestAvailable: false,
        wasBestFit: false,
        valueStars: 1,
        pickAssessment: "Fair",
        reachDelta: 0,
        compositeScore: 50,
      });
      continue;
    }

    const selectedTalent = talentScoreByPlayer.get(selectedKey) ?? 0;
    let talentRank = 1;
    for (const id of availableIds) {
      const score = talentScoreByPlayer.get(id) ?? 0;
      if (score > selectedTalent || (score === selectedTalent && id < selectedKey)) {
        talentRank += 1;
      }
    }

    const selectedFit = applyRosterNeedModifiers(
      draftTalentScore(selectedPlayer, prefs),
      counts,
      selectedPlayer.position,
      selection.round,
      draft.picksPerTeam,
    );
    let fitRank = 1;
    for (const id of availableIds) {
      if (id === selectedKey) continue;
      const player = state.world.players[id as PlayerId];
      if (!player) continue;
      const fit = applyRosterNeedModifiers(
        draftTalentScore(player, prefs),
        counts,
        player.position,
        selection.round,
        draft.picksPerTeam,
      );
      if (
        fit > selectedFit ||
        (fit === selectedFit && id < selectedKey)
      ) {
        fitRank += 1;
      }
    }

    const expectedRank = Math.max(1, Math.round(selection.pickNumber * 0.85));
    const reachDelta = Math.max(0, talentRank - expectedRank);
    const valueStars = valueStarsFromTalentRank(
      talentRank,
      selection.pickNumber,
    );
    const pickAssessment = assessmentFromStars(valueStars, reachDelta);
    const compositeScore = Math.max(
      40,
      Math.min(
        99,
        70 +
          (6 - Math.min(talentRank, 20)) * 1.2 +
          (6 - Math.min(fitRank, 20)) * 0.8 +
          valueStars * 3 -
          reachDelta * 0.4,
      ),
    );

    analyses.push({
      pickNumber: selection.pickNumber,
      teamId: selection.teamId,
      playerId: selection.playerId,
      talentRankAtPick: talentRank,
      fitRankAtPick: fitRank,
      wasBestAvailable: talentRank === 1,
      wasBestFit: fitRank === 1,
      valueStars,
      pickAssessment,
      reachDelta,
      compositeScore: Math.round(compositeScore),
    });

    taken.add(selectedKey);
    counts.set(
      selectedPlayer.position,
      (counts.get(selectedPlayer.position) ?? 0) + 1,
    );
  }

  return analyses;
}

function buildTeamSummary(
  state: GameState,
  teamId: TeamId,
  pickAnalyses: FantasyDraftPickAnalysis[],
): FantasyDraftTeamSummary {
  const draft = state.world.fantasyDraft!;
  const teamSelections = draft.selections.filter((s) => s.teamId === teamId);
  const teamAnalyses = pickAnalyses.filter((a) => a.teamId === teamId);
  const players = teamSelections
    .map((s) => state.world.players[s.playerId])
    .filter((p): p is Player => p !== undefined);

  const playerCount = players.length;
  const avgOvr =
    playerCount === 0
      ? 0
      : Math.round(
          (players.reduce(
            (sum, p) =>
              sum + calculatePlayerOverall(p.position, p.attributes),
            0,
          ) /
            playerCount) *
            10,
        ) / 10;
  const avgPot =
    playerCount === 0
      ? 0
      : Math.round(
          (players.reduce((sum, p) => sum + p.potential.overall, 0) /
            playerCount) *
            10,
        ) / 10;
  const avgAge =
    playerCount === 0
      ? 0
      : Math.round(
          (players.reduce((sum, p) => sum + p.age, 0) / playerCount) * 10,
        ) / 10;

  const counts = fantasyDraftPositionCounts(state, teamId);
  const positionCounts = PLAYER_POSITIONS.map((position) => ({
    position,
    count: counts.get(position) ?? 0,
  }));

  const positionBalance: FantasyDraftPositionBalance[] = PLAYER_POSITIONS.map(
    (position) => {
      const atPos = players.filter((p) => p.position === position);
      const overalls = atPos.map((p) =>
        calculatePlayerOverall(p.position, p.attributes),
      );
      const averageOverall =
        overalls.length > 0
          ? Math.round(
              overalls.reduce((a, b) => a + b, 0) / overalls.length,
            )
          : null;
      return {
        position,
        count: atPos.length,
        level: balanceLevel(atPos.length, averageOverall),
        averageOverall,
      };
    },
  );

  const archetypeMap = new Map<string, number>();
  for (const player of players) {
    const label = ARCHETYPE_LABELS[player.archetype] ?? player.archetype;
    archetypeMap.set(label, (archetypeMap.get(label) ?? 0) + 1);
  }
  const archetypeCounts = [...archetypeMap.entries()].map(
    ([archetype, count]) => ({ archetype, count }),
  );

  const positionalOverlap = positionBalance
    .filter((row) => row.count >= 3)
    .map((row) => row.position);

  let bestPlayer: FantasyDraftPickHighlight | null = null;
  let highestPotential: FantasyDraftPickHighlight | null = null;
  let oldestPick: FantasyDraftPickHighlight | null = null;
  let youngestPick: FantasyDraftPickHighlight | null = null;

  for (const selection of teamSelections) {
    const player = state.world.players[selection.playerId];
    if (!player) continue;
    const h = highlightFromPlayer(player, selection.pickNumber);
    if (!bestPlayer || h.overall > bestPlayer.overall) bestPlayer = h;
    if (!highestPotential || h.potential > highestPotential.potential) {
      highestPotential = h;
    }
    if (!oldestPick || player.age > (state.world.players[oldestPick.playerId]?.age ?? 0)) {
      oldestPick = h;
    }
    if (
      !youngestPick ||
      player.age < (state.world.players[youngestPick.playerId]?.age ?? 99)
    ) {
      youngestPick = h;
    }
  }

  const needs = calculateTeamDraftNeeds(state, teamId);
  const remainingWeaknesses = needs.byPosition
    .filter((n) => n.level === "critical" || n.level === "major")
    .map((n) => ({ position: n.position, level: n.level }));

  const scored = teamAnalyses.map((a) => ({
    analysis: a,
    selection: teamSelections.find((s) => s.pickNumber === a.pickNumber)!,
  }));

  let bestPick: FantasyDraftPickHighlight | null = null;
  let biggestReach: FantasyDraftPickHighlight | null = null;
  let bestValue: FantasyDraftPickHighlight | null = null;

  if (scored.length > 0) {
    const best = [...scored].sort(
      (a, b) => b.analysis.compositeScore - a.analysis.compositeScore,
    )[0]!;
    const reach = [...scored].sort(
      (a, b) => b.analysis.reachDelta - a.analysis.reachDelta,
    )[0]!;
    const value = [...scored].sort(
      (a, b) => b.analysis.valueStars - a.analysis.valueStars,
    )[0]!;
    const bp = state.world.players[best.selection.playerId];
    if (bp) bestPick = highlightFromPlayer(bp, best.selection.pickNumber);
    if (reach.analysis.reachDelta >= 8) {
      const rp = state.world.players[reach.selection.playerId];
      if (rp) biggestReach = highlightFromPlayer(rp, reach.selection.pickNumber);
    }
    const vp = state.world.players[value.selection.playerId];
    if (vp) bestValue = highlightFromPlayer(vp, value.selection.pickNumber);
  }

  const strongValuePickCount = teamAnalyses.filter(
    (a) =>
      a.pickAssessment === "Excellent" ||
      a.pickAssessment === "Strong" ||
      a.valueStars >= 4,
  ).length;

  const avgFitRank =
    teamAnalyses.length === 0
      ? 10
      : teamAnalyses.reduce((s, a) => s + a.fitRankAtPick, 0) /
        teamAnalyses.length;
  const avgTalentRank =
    teamAnalyses.length === 0
      ? 10
      : teamAnalyses.reduce((s, a) => s + a.talentRankAtPick, 0) /
        teamAnalyses.length;
  const valueShare =
    playerCount === 0 ? 0 : strongValuePickCount / playerCount;
  const needPenalty = remainingWeaknesses.length * 4;
  const youthBonus = avgAge <= 24 ? 4 : avgAge <= 26 ? 2 : 0;
  const potBonus = Math.max(0, (avgPot - 80) * 0.4);
  const ovrBonus = Math.max(0, (avgOvr - 76) * 0.5);
  const balancePenalty = positionBalance.filter(
    (b) => b.level === "Weak",
  ).length * 3;

  const composite =
    72 +
    ovrBonus +
    potBonus +
    youthBonus +
    valueShare * 10 -
    Math.min(12, avgTalentRank) * 0.4 -
    Math.min(12, avgFitRank) * 0.3 -
    needPenalty -
    balancePenalty;
  const draftGrade = letterFromScore(composite);
  const draftGradeLabel = gradeLabel(draftGrade);

  const strengths: string[] = [];
  const concerns: string[] = [];

  for (const row of positionBalance) {
    if (row.level === "Excellent" || row.level === "Good") {
      strengths.push(`Strong ${row.position} depth`);
    }
    if (row.level === "Weak") {
      concerns.push(`${row.position} depth is thin`);
    }
  }
  if (avgPot >= 88) strengths.push("Excellent young-player potential");
  else if (avgPot >= 84) strengths.push("Good long-term potential");
  if (avgAge <= 24) strengths.push("Elite young talent");
  if (avgOvr >= 82) strengths.push("High overall talent acquisition");
  if (positionalOverlap.length > 0) {
    concerns.push(
      `Positional overlap at ${positionalOverlap.join(", ")}`,
    );
  }
  if (avgAge >= 28) concerns.push("Limited youth / aging core risk");
  if (players.filter((p) => p.age >= 30).length === 0 && avgAge < 25) {
    concerns.push("Limited veteran presence");
  }
  for (const weak of remainingWeaknesses) {
    const label = `${weak.position} depth`;
    if (!concerns.some((c) => c.includes(weak.position))) {
      concerns.push(
        weak.level === "critical"
          ? `${weak.position} depth is a critical concern`
          : `${label} remains a concern`,
      );
    }
  }

  const uniqueStrengths = [...new Set(strengths)].slice(0, 5);
  const uniqueConcerns = [...new Set(concerns)].slice(0, 5);

  const shortTerm =
    avgOvr >= 82
      ? "Competitive"
      : avgOvr >= 76
        ? "Developing"
        : "Rebuilding";
  const longTerm =
    avgPot >= 88
      ? "Excellent"
      : avgPot >= 84
        ? "Strong"
        : avgPot >= 80
          ? "Promising"
          : "Uncertain";

  const guardHeavy =
    (counts.get("PG") ?? 0) + (counts.get("SG") ?? 0) >=
    Math.ceil(playerCount * 0.5);
  const frontcourtThin =
    (counts.get("PF") ?? 0) + (counts.get("C") ?? 0) <= 2;

  const verdictParts: string[] = [];
  if (avgPot >= 86 && avgAge <= 25) {
    verdictParts.push(
      "The draft added high-upside young talent with strong long-term potential.",
    );
  } else if (avgOvr >= 80) {
    verdictParts.push(
      "The draft produced a talented core ready to contribute soon.",
    );
  } else {
    verdictParts.push(
      "The draft filled the roster with a mix of contributors and developmental pieces.",
    );
  }
  if (guardHeavy) {
    verdictParts.push("The roster is somewhat guard-heavy.");
  }
  if (frontcourtThin) {
    verdictParts.push("Frontcourt depth remains a concern.");
  }
  if (strongValuePickCount >= Math.max(1, playerCount - 1)) {
    verdictParts.push("Pick efficiency was strong across the board.");
  }

  const recommendedNextSteps: string[] = [];
  for (const weak of remainingWeaknesses) {
    recommendedNextSteps.push(
      `Address ${weak.position} depth through free agency or trade`,
    );
  }
  for (const pos of positionalOverlap) {
    recommendedNextSteps.push(`Evaluate positional overlap at ${pos}`);
  }
  if (avgAge < 24) {
    recommendedNextSteps.push("Consider adding veteran depth");
  }
  if (recommendedNextSteps.length === 0) {
    recommendedNextSteps.push("Prepare for free agency and roster fine-tuning");
  }

  const pickBreakdown: FantasyDraftPickBreakdownRow[] = teamSelections.map(
    (selection) => {
      const player = state.world.players[selection.playerId]!;
      const analysis = teamAnalyses.find(
        (a) => a.pickNumber === selection.pickNumber,
      );
      return {
        pickNumber: selection.pickNumber,
        round: selection.round,
        playerId: selection.playerId,
        playerName: `${player.firstName} ${player.lastName}`,
        position: player.position,
        overall: calculatePlayerOverall(player.position, player.attributes),
        potential: player.potential.overall,
        age: player.age,
        assessment: analysis?.pickAssessment ?? "Fair",
        valueStars: analysis?.valueStars ?? 3,
      };
    },
  );

  return {
    teamId,
    playerCount,
    avgOvr,
    avgPot,
    avgAge,
    positionCounts,
    positionBalance,
    archetypeCounts,
    positionalOverlap,
    bestPlayer,
    highestPotential,
    oldestPick,
    youngestPick,
    rosterStrength: avgOvr,
    longTermStrength: avgPot,
    remainingWeaknesses,
    bestPick,
    biggestReach,
    bestValue,
    strongValuePickCount,
    draftGrade,
    draftGradeLabel,
    draftVerdict: verdictParts.join(" "),
    strengths: uniqueStrengths,
    concerns: uniqueConcerns,
    teamOutlook: {
      shortTerm,
      longTerm,
      narrative: `Short term: ${shortTerm}. Long term: ${longTerm}.`,
    },
    recommendedNextSteps: [...new Set(recommendedNextSteps)].slice(0, 5),
    pickBreakdown,
  };
}

function buildLeagueRecap(
  state: GameState,
  teamSummaries: Record<string, FantasyDraftTeamSummary>,
  pickAnalyses: FantasyDraftPickAnalysis[],
): FantasyDraftLeagueRecap {
  const draft = state.world.fantasyDraft!;
  const teamIds = draft.draftOrder;

  function teamName(teamId: string): string {
    const team = state.world.teams[teamId as TeamId];
    return team ? `${team.city} ${team.name}` : teamId;
  }

  function award(
    teamId: string,
    detail: string,
    extra?: Partial<FantasyDraftLeagueAward>,
  ): FantasyDraftLeagueAward {
    return {
      teamId: teamId as TeamId,
      teamName: teamName(teamId),
      detail,
      ...extra,
    };
  }

  let bestDraft: FantasyDraftLeagueAward | null = null;
  let bestGradeIdx = 99;
  for (const teamId of teamIds) {
    const summary = teamSummaries[teamId];
    if (!summary) continue;
    const idx = GRADE_ORDER.indexOf(
      summary.draftGrade as (typeof GRADE_ORDER)[number],
    );
    const gradeIdx = idx >= 0 ? idx : 98;
    if (gradeIdx < bestGradeIdx) {
      bestGradeIdx = gradeIdx;
      bestDraft = award(
        teamId,
        `Grade ${summary.draftGrade} · Avg OVR ${summary.avgOvr}`,
        { value: summary.avgOvr },
      );
    }
  }

  let biggestSteal: FantasyDraftLeagueAward | null = null;
  let bestStealGap = -Infinity;
  for (const analysis of pickAnalyses) {
    const gap = analysis.pickNumber - analysis.talentRankAtPick;
    if (gap > bestStealGap) {
      bestStealGap = gap;
      const player = state.world.players[analysis.playerId];
      biggestSteal = award(
        analysis.teamId,
        `Selected #${analysis.pickNumber} · Talent rank #${analysis.talentRankAtPick}`,
        {
          playerId: analysis.playerId,
          playerName: player
            ? `${player.firstName} ${player.lastName}`
            : analysis.playerId,
          pickNumber: analysis.pickNumber,
          value: gap,
        },
      );
    }
  }

  let biggestReach: FantasyDraftLeagueAward | null = null;
  let maxReach = 0;
  for (const analysis of pickAnalyses) {
    if (analysis.reachDelta > maxReach) {
      maxReach = analysis.reachDelta;
      const player = state.world.players[analysis.playerId];
      biggestReach = award(
        analysis.teamId,
        `Reach delta ${analysis.reachDelta} at pick #${analysis.pickNumber}`,
        {
          playerId: analysis.playerId,
          playerName: player
            ? `${player.firstName} ${player.lastName}`
            : analysis.playerId,
          pickNumber: analysis.pickNumber,
          value: analysis.reachDelta,
        },
      );
    }
  }

  let mostAggressive: FantasyDraftLeagueAward | null = null;
  let maxAvgReach = -Infinity;
  for (const teamId of teamIds) {
    const teamPicks = pickAnalyses.filter((a) => a.teamId === teamId);
    if (teamPicks.length === 0) continue;
    const avg =
      teamPicks.reduce((s, a) => s + a.reachDelta, 0) / teamPicks.length;
    if (avg > maxAvgReach) {
      maxAvgReach = avg;
      mostAggressive = award(
        teamId,
        `Avg reach delta ${avg.toFixed(1)}`,
        { value: avg },
      );
    }
  }

  let youngestDraft: FantasyDraftLeagueAward | null = null;
  let minAge = Infinity;
  let highestAvgOvr: FantasyDraftLeagueAward | null = null;
  let maxOvr = -Infinity;
  let highestAvgPot: FantasyDraftLeagueAward | null = null;
  let maxPot = -Infinity;

  for (const teamId of teamIds) {
    const summary = teamSummaries[teamId];
    if (!summary) continue;
    if (summary.avgAge < minAge) {
      minAge = summary.avgAge;
      youngestDraft = award(
        teamId,
        `Avg age ${summary.avgAge}`,
        { value: summary.avgAge },
      );
    }
    if (summary.avgOvr > maxOvr) {
      maxOvr = summary.avgOvr;
      highestAvgOvr = award(
        teamId,
        `Avg OVR ${summary.avgOvr}`,
        { value: summary.avgOvr },
      );
    }
    if (summary.avgPot > maxPot) {
      maxPot = summary.avgPot;
      highestAvgPot = award(
        teamId,
        `Avg POT ${summary.avgPot}`,
        { value: summary.avgPot },
      );
    }
  }

  return {
    bestDraft,
    biggestSteal,
    biggestReach,
    mostAggressive,
    youngestDraft,
    highestAvgOvr,
    highestAvgPot,
  };
}

/**
 * Runs full analysis and returns fields to merge onto FantasyDraft at completion.
 */
export function analyzeFantasyDraft(state: GameState): {
  pickAnalyses: FantasyDraftPickAnalysis[];
  teamSummaries: Record<string, FantasyDraftTeamSummary>;
  leagueRecap: FantasyDraftLeagueRecap;
} {
  const draft = state.world.fantasyDraft;
  if (draft === null) {
    return { pickAnalyses: [], teamSummaries: {}, leagueRecap: {
      bestDraft: null,
      biggestSteal: null,
      biggestReach: null,
      mostAggressive: null,
      youngestDraft: null,
      highestAvgOvr: null,
      highestAvgPot: null,
    } };
  }

  const pickAnalyses = analyzeFantasyDraftPicks(state);
  const teamSummaries: Record<string, FantasyDraftTeamSummary> = {};
  for (const teamId of draft.draftOrder) {
    teamSummaries[teamId] = buildTeamSummary(
      state,
      teamId,
      pickAnalyses,
    );
  }
  const leagueRecap = buildLeagueRecap(state, teamSummaries, pickAnalyses);
  return { pickAnalyses, teamSummaries, leagueRecap };
}
