/**
 * Turns timeline posts into social posts: picks an author, then a text
 * template, both by hash of (saveId, post.id, salt). Every number and name in
 * the text comes from the post's attachment; templates only add tone.
 */

import { formatGameDate } from "@/presentation/game-date";
import type { GameState } from "@/state/game-state";
import {
  buildLeagueCast,
  type LeagueCast,
  type TimelineAccount,
} from "./accounts";
import {
  cleanBodyPart,
  formatSeasonLabel,
  fullName,
  sentenceCase,
  the,
  withArticle,
  gameSides,
  gameTag,
  joinParts,
  listNames,
  monthName,
  teamTag,
} from "./compose-text";
import { composeReplies, type ComposedReply } from "./compose-replies";
import { computeEngagement, type Engagement } from "./engagement";
import { hashParts, pick } from "./seed";
import type {
  AwardAttachment,
  AwardRaceAttachment,
  GameAttachment,
  InjuryAttachment,
  LeagueAttachment,
  PerformanceAttachment,
  PlayoffAttachment,
  SigningAttachment,
  StreakAttachment,
  TimelinePost,
  TradeAttachment,
} from "./types";

export type ComposedPostText = {
  authorKey: string;
  text: string;
  templateId: string;
};

export type ComposedPost = {
  post: TimelinePost;
  author: TimelineAccount;
  text: string;
  templateId: string;
  replies: ComposedReply[];
  engagement: Engagement;
};

type Voice = "team" | "league" | "news";
type VoiceCtx = { voice: Voice; won: boolean | null };
/** Returns null when the variant does not fit the author or the data. */
type Variant = (ctx: VoiceCtx) => string | null;
type TemplateSet = { caseKey: string; variants: Variant[] };

const anyone =
  (build: () => string | null): Variant =>
  () =>
    build();
const news =
  (build: () => string | null): Variant =>
  (ctx) =>
    ctx.voice === "team" ? null : build();
const teamVoice =
  (build: () => string | null): Variant =>
  (ctx) =>
    ctx.voice === "team" ? build() : null;
const hype =
  (build: () => string | null): Variant =>
  (ctx) =>
    ctx.voice === "team" && ctx.won === true ? build() : null;
const down =
  (build: () => string | null): Variant =>
  (ctx) =>
    ctx.voice === "team" && ctx.won === false ? build() : null;

// ---------------------------------------------------------------- games

function gameTemplates(g: GameAttachment): TemplateSet {
  const set = gameCaseTemplates(g);
  if (g.series) return set;
  const { loser: L, winnerScore: ws, loserScore: ls } = gameSides(g);
  const tag = gameTag(g);
  // Every case gets a second team-voice option for each result.
  set.variants.push(
    hype(() =>
      joinParts(`Another one in the books, ${ws}–${ls} over ${the(L)}.`, tag),
    ),
    down(() => joinParts(`${ws}–${ls}. We learn from this and move on.`, tag)),
  );
  return set;
}

function gameCaseTemplates(g: GameAttachment): TemplateSet {
  const { winner: W, loser: L, winnerScore: ws, loserScore: ls } = gameSides(g);
  const tag = gameTag(g);
  const performer = gameSides(g).winnerIsHome
    ? g.topPerformers.home
    : g.topPerformers.away;

  if (g.series) {
    const wins = g.series.wins;
    const sw = wins[W.teamId] ?? 0;
    const sl = wins[L.teamId] ?? 0;
    const line =
      sw >= g.series.winsToClinch
        ? `${the(W)} win the series ${sw}–${sl}`
        : sw > sl
          ? `${the(W)} lead the series ${sw}–${sl}`
          : sw < sl
            ? `${the(L)} lead the series ${sl}–${sw}`
            : `The series is tied ${sw}–${sl}`;
    const n = g.series.gameNumber;
    const round = g.series.roundLabel;
    return {
      caseKey: "series",
      variants: [
        news(() =>
          joinParts(
            `${the(W)} take Game ${n} of the ${round}, ${ws}–${ls} over ${the(L)}.`,
            `${line}.`,
            tag,
          ),
        ),
        news(() =>
          joinParts(
            `${line} after ${the(W)} beat ${the(L)} ${ws}–${ls} in Game ${n}.`,
            tag,
          ),
        ),
        news(() =>
          joinParts(
            `Game ${n} ends ${ws}–${ls} in favor of ${the(W)}.`,
            `${line}.`,
          ),
        ),
        hype(() =>
          joinParts(`Game ${n} is ours, ${ws}–${ls}.`, `${line}.`, tag),
        ),
        hype(() =>
          joinParts(`We take Game ${n}, ${ws}–${ls}.`, `${line}.`, tag),
        ),
        down(() =>
          joinParts(
            `${ws}–${ls} in Game ${n}.`,
            `${line}.`,
            "Back at it next game.",
          ),
        ),
        down(() =>
          joinParts(
            `Not the result we wanted in Game ${n}, ${ws}–${ls}.`,
            `${line}.`,
            "We go again.",
          ),
        ),
      ],
    };
  }

  if (g.overtimePeriods > 0 || g.reasons.includes("overtime")) {
    const label =
      g.overtimePeriods > 1 ? `${g.overtimePeriods} overtimes` : "overtime";
    return {
      caseKey: "overtime",
      variants: [
        news(() =>
          joinParts(
            `${the(W)} outlast ${the(L)} ${ws}–${ls} in ${label}.`,
            tag,
          ),
        ),
        news(() =>
          joinParts(
            `Extra time was needed, and ${the(W)} had the answer: ${ws}–${ls} over ${the(L)}.`,
          ),
        ),
        news(() =>
          joinParts(
            `${the(L)} pushed ${the(W)} to ${label} before falling ${ws}–${ls}.`,
            tag,
          ),
        ),
        hype(() =>
          joinParts(`We needed ${label} and we got it done, ${ws}–${ls}.`, tag),
        ),
        down(() =>
          joinParts(
            `Came up just short in ${label}, ${ws}–${ls}. Proud of the fight.`,
            tag,
          ),
        ),
      ],
    };
  }

  if (g.reasons.includes("comeback") && g.comebackDeficit > 0) {
    const d = g.comebackDeficit;
    return {
      caseKey: "comeback",
      variants: [
        news(() =>
          joinParts(
            `${the(W)} erased a ${d}-point deficit to beat ${the(L)} ${ws}–${ls}.`,
            tag,
          ),
        ),
        news(
          () =>
            `Down ${d} at one point, ${the(W)} rallied past ${the(L)} ${ws}–${ls}.`,
        ),
        news(() =>
          joinParts(
            `${the(W)} came back from ${d} down to win ${ws}–${ls}.`,
            tag,
          ),
        ),
        hype(() =>
          joinParts(`Down ${d}, never out. We take it ${ws}–${ls}.`, tag),
        ),
        down(() =>
          joinParts(
            `We led by ${d} at one point and let it get away, ${ws}–${ls}.`,
            tag,
          ),
        ),
      ],
    };
  }

  if (g.reasons.includes("upset")) {
    return {
      caseKey: "upset",
      variants: [
        news(() =>
          joinParts(
            `${the(W)} knock off ${the(L)} ${ws}–${ls}, a result few saw coming.`,
            tag,
          ),
        ),
        news(() => `${ws}–${ls}. ${the(W)} take down the favored ${the(L)}.`),
        news(() =>
          joinParts(`${the(L)} stumble against ${the(W)}, ${ws}–${ls}.`, tag),
        ),
        hype(() =>
          joinParts(
            `Nobody picked us tonight. ${ws}–${ls} over ${the(L)}.`,
            tag,
          ),
        ),
        down(() =>
          joinParts(
            `Tough one against ${the(W)}, ${ws}–${ls}. We owe ourselves a better effort.`,
            tag,
          ),
        ),
      ],
    };
  }

  if (g.reasons.includes("blowout")) {
    const m = g.margin;
    return {
      caseKey: "blowout",
      variants: [
        news(() =>
          joinParts(
            `${the(W)} cruise past ${the(L)} ${ws}–${ls}, a ${m}-point margin.`,
            tag,
          ),
        ),
        news(() =>
          joinParts(
            `A ${m}-point rout: ${the(W)} ${ws}, ${the(L)} ${ls}.`,
            tag,
          ),
        ),
        news(
          () =>
            `${the(L)} never found a rhythm in a ${ws}–${ls} loss to ${the(W)}.`,
        ),
        hype(() =>
          joinParts(
            `A ${m}-point win, ${ws}–${ls}. Complete team effort.`,
            tag,
          ),
        ),
        down(() =>
          joinParts(`Rough night, ${ws}–${ls}. We will be better.`, tag),
        ),
      ],
    };
  }

  return {
    caseKey: "plain",
    variants: [
      news(() => joinParts(`${the(W)} beat ${the(L)} ${ws}–${ls}.`, tag)),
      news(() =>
        performer
          ? joinParts(
              `${the(W)} beat ${the(L)} ${ws}–${ls}.`,
              `${fullName(performer.player)} led the way with ${performer.line.points} points.`,
              tag,
            )
          : null,
      ),
      news(() => `${the(L)} fall ${ws}–${ls} to ${the(W)}. ${tag}`),
      news(() => `${the(W)} ${ws}, ${the(L)} ${ls} at the final buzzer.`),
      hype(() => joinParts(`Got it done, ${ws}–${ls} over ${the(L)}.`, tag)),
      hype(() =>
        performer
          ? joinParts(
              `${ws}–${ls} win. ${fullName(performer.player)} scored ${performer.line.points}.`,
              tag,
            )
          : null,
      ),
      down(() =>
        joinParts(`Not our night against ${the(W)}, ${ws}–${ls}.`, tag),
      ),
      down(() =>
        joinParts(
          `Dropped a ${ws}–${ls} decision to ${the(W)}. We regroup and go again.`,
          tag,
        ),
      ),
    ],
  };
}

// ---------------------------------------------------------- performances

function performanceTemplates(p: PerformanceAttachment): TemplateSet {
  const name = fullName(p.player);
  const { line: l, team: T, opponent: O } = p;
  const tag = teamTag(T);
  // The card carries the stat line; the text names the points once, as tone.
  const pts = l.points;
  const result = p.won ? "in a win over" : "in a loss to";
  return {
    caseKey: "line",
    variants: [
      news(() =>
        joinParts(`${name} scored ${pts} ${result} the ${O.name}.`, tag),
      ),
      news(() =>
        joinParts(`${name} poured in ${pts} against the ${O.name}.`, tag),
      ),
      news(() =>
        joinParts(
          `${pts} for ${name}: a big night ${result} the ${O.name}.`,
          tag,
        ),
      ),
      news(() =>
        p.reasons.includes("triple_double")
          ? joinParts(
              `${name} recorded a ${pts}-point triple-double ${result} the ${O.name}.`,
              tag,
            )
          : null,
      ),
      news(() =>
        p.reasons.includes("forty_points")
          ? joinParts(`Another ${pts}-piece from ${name}.`, tag)
          : null,
      ),
      hype(() =>
        joinParts(`${name} was on another level tonight. ${pts} points.`, tag),
      ),
      down(() =>
        joinParts(`${name} gave us ${pts} tonight. We keep working.`, tag),
      ),
      teamVoice(() =>
        joinParts(
          `${name} led the way with ${pts} against the ${O.name}.`,
          tag,
        ),
      ),
    ],
  };
}

// ---------------------------------------------------------------- awards

/** A number-free line on why this award was won; null when there is none. */
function awardAngle(a: AwardAttachment): string | null {
  const improved = a.improvement !== null && a.improvement > 0;
  switch (a.awardId) {
    case "roy":
    case "rookie_of_month":
      return "Top of the rookie class.";
    case "dpoy":
    case "defensive_player_of_month":
      return "Honored for the work on the defensive end.";
    case "sixth_man":
      return "The best player off the bench this season.";
    case "most_improved":
      return improved ? "A big step up from last season." : null;
    case "coach_of_year":
      return improved ? "A turnaround season on the sideline." : null;
    default:
      return null;
  }
}

function awardTemplates(a: AwardAttachment): TemplateSet {
  const player = a.winner ? fullName(a.winner) : null;
  const name = player ?? a.winnerCoachName;
  const month = monthName(a.period);
  const monthly = a.cadence === "monthly";
  const season = formatSeasonLabel(a.seasonYear);
  const when = monthly ? (month ?? "the month") : season;
  const of = a.team ? ` of the ${a.team.displayName}` : "";
  const tag = teamTag(a.team);
  // The card shows the award's numbers and the team record; the text gives
  // the angle instead of repeating them.
  const angle = awardAngle(a);

  if (!name) {
    return {
      caseKey: "unknown",
      variants: [
        anyone(() => `The ${a.awardName} for ${when} has been announced.`),
        anyone(() => `${a.awardName} honors have been announced for ${when}.`),
      ],
    };
  }

  if (!player) {
    return {
      caseKey: `${a.cadence}_coach`,
      variants: [
        anyone(() =>
          joinParts(
            `${name}${of} is the ${a.awardName} for ${when}.`,
            angle,
            tag,
          ),
        ),
        anyone(() =>
          joinParts(
            `The league has named ${name} its ${a.awardName} for ${when}.`,
            angle,
            tag,
          ),
        ),
        anyone(() =>
          joinParts(
            `Congratulations to ${name}${of} on the ${a.awardName}.`,
            angle,
          ),
        ),
        anyone(() =>
          a.runnerUp
            ? joinParts(
                `${name} takes the ${a.awardName}, ahead of ${a.runnerUp.name}.`,
                tag,
              )
            : null,
        ),
      ],
    };
  }

  if (monthly) {
    return {
      caseKey: "monthly_player",
      variants: [
        anyone(() =>
          joinParts(`${name} is the ${a.awardName} for ${when}.`, angle, tag),
        ),
        anyone(() =>
          joinParts(
            `The ${a.awardName} for ${when} goes to ${name}${of}.`,
            angle,
          ),
        ),
        anyone(() =>
          joinParts(
            `Congratulations to ${name}${of}, named ${a.awardName} for ${when}.`,
            angle,
            tag,
          ),
        ),
        anyone(() =>
          a.runnerUp
            ? joinParts(
                `${name} edges ${a.runnerUp.name} for ${a.awardName} honors in ${when}.`,
                tag,
              )
            : null,
        ),
      ],
    };
  }

  return {
    caseKey: "yearly_player",
    variants: [
      anyone(() =>
        joinParts(
          `${name}${of} has been named the ${season} ${a.awardName}.`,
          angle,
          tag,
        ),
      ),
      anyone(() =>
        joinParts(
          `The league has honored ${name} with the ${a.awardName} for ${season}.`,
          angle,
          tag,
        ),
      ),
      anyone(() =>
        joinParts(
          `Congratulations to ${name}, this season's ${a.awardName} winner.`,
          angle,
          tag,
        ),
      ),
      anyone(() =>
        a.runnerUp
          ? joinParts(
              `${name} takes the ${a.awardName}, ahead of ${a.runnerUp.name}.`,
              tag,
            )
          : joinParts(`${name} wins the ${a.awardName}.`, tag),
      ),
    ],
  };
}

// ----------------------------------------------------------- award races

const RACE_LABELS: Partial<Record<AwardRaceAttachment["awardId"], string>> = {
  mvp: "MVP",
  dpoy: "DPOY",
  roy: "ROY",
};
const LADDER_LENGTH = 3;

function awardRaceTemplates(r: AwardRaceAttachment): TemplateSet {
  const label = RACE_LABELS[r.awardId] ?? r.awardName;
  const week = formatGameDate(r.throughDate);
  const named = r.contenders.flatMap((c) => {
    const name = c.player ? fullName(c.player) : c.coachName;
    return name ? [{ name, abbreviation: c.team?.abbreviation ?? null }] : [];
  });
  const lead = named[0];
  const second = named[1];
  const prev = r.previousLeaderName;
  if (!lead) {
    return {
      caseKey: "empty",
      variants: [anyone(() => `The ${label} race is taking shape.`)],
    };
  }
  const ladder = named
    .slice(0, LADDER_LENGTH)
    .map(
      (c, i) =>
        `${i + 1}. ${c.name}${c.abbreviation ? ` (${c.abbreviation})` : ""}`,
    )
    .join(" ");
  return {
    caseKey: prev ? "new_leader" : "ladder",
    variants: [
      anyone(() => `${label} ladder, week ending ${week}: ${ladder}`),
      anyone(() => `The ${label} race through ${week}: ${ladder}`),
      anyone(() =>
        prev
          ? joinParts(
              `${lead.name} takes over the top of the ${label} race from ${prev}.`,
              ladder,
            )
          : null,
      ),
      anyone(() =>
        prev
          ? `New leader in the ${label} race: ${lead.name} moves past ${prev}.`
          : null,
      ),
      anyone(() =>
        !prev && second
          ? `${lead.name} leads the ${label} race, with ${second.name} next in line.`
          : null,
      ),
    ],
  };
}

// -------------------------------------------------------------- playoffs

function playoffTemplates(p: PlayoffAttachment): TemplateSet {
  const W = p.winner;
  const L = p.loser;
  const s = p.seriesScore;
  const rp = p.roundLabel ? `the ${p.roundLabel}` : "the playoffs";
  const tag = teamTag(W);
  const year = formatSeasonLabel(p.seasonYear);

  if (p.event === "champion") {
    return {
      caseKey: "champion",
      variants: [
        anyone(() =>
          joinParts(
            `The ${W.displayName} are the ${year} champions${L && s ? `, beating the ${L.name} ${s.winner}–${s.loser} in the final series` : ""}.`,
            tag,
          ),
        ),
        anyone(() =>
          joinParts(
            `Congratulations to the ${W.displayName}, champions of ${year}.`,
            s ? `The series finished ${s.winner}–${s.loser}.` : null,
          ),
        ),
        anyone(() =>
          joinParts(`The ${year} title belongs to the ${W.displayName}.`, tag),
        ),
        anyone(() =>
          joinParts(
            `The ${W.name} close out ${year} as champions${L ? `, ahead of the ${L.name}` : ""}.`,
            tag,
          ),
        ),
      ],
    };
  }

  if (p.event === "previous_champion") {
    return {
      caseKey: "previous_champion",
      variants: [
        anyone(() =>
          joinParts(
            `The ${W.name} are the defending champions after winning the ${year} title.`,
            tag,
          ),
        ),
        anyone(
          () =>
            `The ${W.displayName} come in as reigning champions from ${year}.`,
        ),
        anyone(
          () =>
            `The ${year} champions, the ${W.displayName}, are back to defend the title.`,
        ),
        anyone(() =>
          joinParts(`The ${W.name} hold the title from ${year}.`, tag),
        ),
      ],
    };
  }

  if (!s) {
    return {
      caseKey: "series_won_noscore",
      variants: [
        news(() => joinParts(`${the(W)} advance in ${rp}.`, tag)),
        news(() => `The ${W.displayName} are moving on.`),
        teamVoice(() => joinParts("We are moving on.", tag)),
        teamVoice(() => joinParts(`Series won. On to the next round.`, tag)),
      ],
    };
  }

  const a = s.winner;
  const b = s.loser;
  if (p.sweep && L) {
    return {
      caseKey: "series_won_sweep",
      variants: [
        news(() =>
          joinParts(
            `${the(W)} sweep ${the(L)} ${a}–${b} and move on from ${rp}.`,
            tag,
          ),
        ),
        news(
          () =>
            `A clean ${a}–${b} sweep sends the ${W.displayName} through ${rp}.`,
        ),
        teamVoice(() =>
          joinParts(
            `We swept the ${L.name}, ${a}–${b}. On to the next round.`,
            tag,
          ),
        ),
        teamVoice(() =>
          joinParts(`${a}–${b}. Series over, and we are moving on.`, tag),
        ),
      ],
    };
  }
  if (p.wentDistance && L && a + b === 7) {
    return {
      caseKey: "series_won_game7",
      variants: [
        news(() =>
          joinParts(
            `${the(W)} survive Game 7 to beat ${the(L)} ${a}–${b} in ${rp}.`,
            tag,
          ),
        ),
        news(
          () =>
            `It went the distance, and ${the(W)} are through, ${a}–${b} over ${the(L)}.`,
        ),
        news(
          () =>
            `${a}–${b}: the ${W.displayName} outlast ${the(L)} in a full seven games.`,
        ),
        teamVoice(() =>
          joinParts(`Game 7 is ours. We take the series ${a}–${b}.`, tag),
        ),
        teamVoice(() =>
          joinParts(`Seven games, ${a}–${b}, and we are through.`, tag),
        ),
      ],
    };
  }
  return {
    caseKey: "series_won",
    variants: [
      news(() =>
        L
          ? joinParts(
              `${the(W)} eliminate ${the(L)}, ${a}–${b}, in ${rp}.`,
              tag,
            )
          : null,
      ),
      news(() =>
        joinParts(
          `${the(W)} take the series ${a}–${b}${L ? ` over ${the(L)}` : ""}.`,
          tag,
        ),
      ),
      news(() =>
        L
          ? `${the(L)} are out. ${the(W)} advance after a ${a}–${b} series.`
          : null,
      ),
      teamVoice(() =>
        joinParts(`Series won, ${a}–${b}. On to the next round.`, tag),
      ),
      teamVoice(() =>
        L
          ? joinParts(`The ${L.name} are done, ${a}–${b}. We keep going.`, tag)
          : null,
      ),
    ],
  };
}

// --------------------------------------------------------------- streaks

function streakTemplates(s: StreakAttachment): TemplateSet {
  const T = s.team;
  const n = s.length;
  const tag = teamTag(T);
  const by = s.snappedBy;
  if (s.event === "win_streak") {
    return {
      caseKey: "win_streak",
      variants: [
        anyone(() => joinParts(`${the(T)} have now won ${n} straight.`, tag)),
        anyone(() =>
          joinParts(`${n} wins in a row for the ${T.displayName}.`, tag),
        ),
        anyone(() => `The ${T.name} are rolling, with ${n} consecutive wins.`),
        anyone(
          () => `${n} straight wins, and the ${T.name} are not slowing down.`,
        ),
      ],
    };
  }
  if (s.event === "losing_streak") {
    return {
      caseKey: "losing_streak",
      variants: [
        anyone(() => joinParts(`${the(T)} have lost ${n} in a row.`, tag)),
        anyone(() => `The ${T.displayName} skid reaches ${n} games.`),
        anyone(
          () =>
            `${n} straight losses for the ${T.name}, and the pressure is building.`,
        ),
        anyone(
          () =>
            `The ${T.name} are still searching for a win after ${n} straight losses.`,
        ),
      ],
    };
  }
  return {
    caseKey: "streak_snapped",
    variants: [
      anyone(() =>
        by
          ? joinParts(
              `The ${T.name} win streak ends at ${n} games, thanks to ${the(by)}.`,
              tag,
            )
          : null,
      ),
      anyone(() =>
        by
          ? joinParts(
              `${the(by)} stop the ${T.name} after ${n} consecutive wins.`,
              tag,
            )
          : null,
      ),
      anyone(() =>
        by
          ? `${n} wins in a row, and then ${the(by)} said no. The ${T.name} streak is over.`
          : null,
      ),
      anyone(() => `The ${T.name} winning streak ends at ${n} games.`),
      anyone(() =>
        joinParts(`After ${n} straight wins, the ${T.name} finally lose.`, tag),
      ),
    ],
  };
}

// ---------------------------------------------------------------- trades

function tradeTemplates(t: TradeAttachment): TemplateSet {
  const mv = t.movements[0] ?? null;
  const name = mv ? fullName(mv.player) : null;
  const to = mv
    ? (t.teams.find((x) => x.teamId === mv.toTeamId) ?? null)
    : null;
  const from = mv
    ? (t.teams.find((x) => x.teamId === mv.fromTeamId) ?? null)
    : null;
  const parties =
    t.teams.length >= 2 ? listNames(t.teams.map((x) => the(x))) : "two clubs";
  const piece = t.otherPieces[0] ?? null;
  const tag = teamTag(to ?? t.teams[0]);
  return {
    caseKey: "trade",
    variants: [
      news(() =>
        name && to && from
          ? joinParts(
              `${name} is on the move, from the ${from.name} to the ${to.name}.`,
              tag,
            )
          : null,
      ),
      news(() =>
        name && to
          ? `Trade completed between ${parties}, with ${name} headed to the ${to.name}.`
          : null,
      ),
      news(() =>
        t.movements.length > 1
          ? joinParts(
              `${t.movements.length} players change teams as ${parties} complete a trade.`,
              tag,
            )
          : null,
      ),
      news(() =>
        piece ? `The deal between ${parties} also includes ${piece}.` : null,
      ),
      anyone(() => `A trade is official between ${parties}.`),
      anyone(() => `Roster changes are coming for ${parties} after a trade.`),
    ],
  };
}

// -------------------------------------------------------------- signings

function signingTemplates(s: SigningAttachment): TemplateSet {
  const name = s.player ? fullName(s.player) : null;
  const T = s.team;
  const tag = teamTag(T);
  const body =
    s.summary.trim() && s.summary.trim() !== s.headline.trim()
      ? s.summary.trim()
      : null;
  return {
    caseKey: "signing",
    variants: [
      teamVoice(() =>
        name && T ? joinParts(`Welcome to the ${T.name}, ${name}.`, tag) : null,
      ),
      teamVoice(() =>
        name && T
          ? joinParts(`${name} is officially a ${the(T)} player now.`, tag)
          : null,
      ),
      teamVoice(() => (body ? joinParts(body, tag) : null)),
      teamVoice(() =>
        T ? joinParts(`New addition for the ${T.name}.`, tag) : null,
      ),
      news(() =>
        name && T ? joinParts(`The ${T.name} add ${name}.`, body, tag) : null,
      ),
      news(() =>
        name && T
          ? joinParts(`${name} is joining the ${T.displayName}.`, tag)
          : null,
      ),
      news(() => body),
      anyone(() => "Another roster move is in the books."),
      anyone(() =>
        joinParts(
          `A new signing is official${T ? ` for the ${T.name}` : ""}.`,
          body,
        ),
      ),
    ],
  };
}

// --------------------------------------------------------------- injuries

function injuryTemplates(i: InjuryAttachment): TemplateSet {
  const name = i.player ? fullName(i.player) : null;
  const T = i.team;
  const tag = teamTag(T);
  const part = cleanBodyPart(i.bodyPart);
  const ret = i.expectedReturn;
  let retText: string | null = null;
  if (ret) {
    const first = formatGameDate(ret.earliest);
    const last = formatGameDate(ret.latest);
    retText =
      first === last ? `around ${first}` : `between ${first} and ${last}`;
  }
  return {
    caseKey: "injury",
    variants: [
      anyone(() =>
        name && part
          ? joinParts(
              `${name} is dealing with ${withArticle(`${part} injury`)}.`,
              tag,
            )
          : null,
      ),
      anyone(() =>
        name && retText
          ? joinParts(`${name} is expected back ${retText}.`, tag)
          : null,
      ),
      anyone(() =>
        name && i.severity && part
          ? joinParts(
              `${name} has suffered ${withArticle(`${i.severity} ${part} injury`)}.`,
              tag,
            )
          : null,
      ),
      anyone(() =>
        name && i.severity && !part
          ? joinParts(
              `${name} is dealing with ${withArticle(`${i.severity} injury`)}.`,
              tag,
            )
          : null,
      ),
      anyone(() =>
        name && T
          ? joinParts(`The ${T.name} are monitoring ${name}'s status.`, tag)
          : null,
      ),
      anyone(() =>
        name ? joinParts(`${name} has been listed with an injury.`, tag) : null,
      ),
      anyone(() =>
        name
          ? joinParts(`${name} is being evaluated for an injury.`, tag)
          : null,
      ),
      anyone(() =>
        name
          ? null
          : joinParts(
              `Injury update ${T ? `from the ${T.name}` : "from around the league"}.`,
              retText ? `Expected return ${retText}.` : null,
            ),
      ),
      anyone(() =>
        name
          ? null
          : `An injury is worth watching${T ? ` for the ${T.name}` : ""}.`,
      ),
    ],
  };
}

// ---------------------------------------------------------- league/other

function leagueTemplates(
  l: LeagueAttachment,
  caseKey: "league" | "transaction",
): TemplateSet {
  const headline = l.headline.trim();
  const summary = l.summary.trim();
  const body = summary && summary !== headline ? summary : null;
  const base = body ?? headline;
  return {
    caseKey,
    variants: [
      anyone(() => body),
      anyone(() =>
        base ? `Around the league, here is what happened. ${base}` : null,
      ),
      anyone(() => (base ? `Worth a look. ${base}` : null)),
      anyone(() =>
        base ? `The latest from around the league. ${base}` : null,
      ),
    ],
  };
}

// ---------------------------------------------------------------- engine

function templatesFor(post: TimelinePost): TemplateSet {
  const a = post.attachment;
  switch (a.type) {
    case "game":
      return gameTemplates(a);
    case "performance":
      return performanceTemplates(a);
    case "award":
      return awardTemplates(a);
    case "award_race":
      return awardRaceTemplates(a);
    case "playoff":
      return playoffTemplates(a);
    case "streak":
      return streakTemplates(a);
    case "trade":
      return tradeTemplates(a);
    case "signing":
      return signingTemplates(a);
    case "injury":
      return injuryTemplates(a);
    case "league":
      return leagueTemplates(
        a,
        post.kind === "transaction" ? "transaction" : "league",
      );
  }
}

function dedupe(accounts: Array<TimelineAccount | null>): TimelineAccount[] {
  const seen = new Set<string>();
  const out: TimelineAccount[] = [];
  for (const account of accounts) {
    if (!account || seen.has(account.key)) continue;
    seen.add(account.key);
    out.push(account);
  }
  return out;
}

/** The accounts that may author this post, in a stable order. */
export function authorCandidates(
  state: GameState,
  cast: LeagueCast,
  post: TimelinePost,
): TimelineAccount[] {
  const a = post.attachment;
  const viewer = state.user.activeOwnerTeamId;
  let list: Array<TimelineAccount | null>;
  switch (a.type) {
    case "game": {
      const { winner } = gameSides(a);
      const viewerPlayed = a.home.teamId === viewer || a.away.teamId === viewer;
      if (viewerPlayed) {
        list = [cast.team(viewer), cast.beatFor(viewer)];
      } else if (a.series || a.competitionType === "playoffs") {
        list = [cast.team(winner.teamId), cast.insider];
      } else {
        list = [cast.beatFor(winner.teamId), cast.analyst];
      }
      break;
    }
    case "performance":
      list = [cast.team(a.team.teamId), cast.analyst];
      break;
    case "award":
    case "award_race":
      list = [cast.league];
      break;
    case "playoff":
      list =
        a.event === "champion"
          ? [cast.league]
          : a.event === "series_won"
            ? [cast.team(a.winner.teamId), cast.insider]
            : [cast.insider];
      break;
    case "streak":
      list = [cast.analyst, cast.beatFor(a.team.teamId)];
      break;
    case "trade":
      list = [cast.insider];
      break;
    case "signing":
      list = [a.team ? cast.team(a.team.teamId) : null, cast.insider];
      break;
    case "injury":
      list = [a.team ? cast.beatFor(a.team.teamId) : cast.insider];
      break;
    case "league":
      list = [cast.league, cast.insider];
      break;
  }
  const result = dedupe(list);
  return result.length > 0 ? result : [cast.insider];
}

function voiceContext(post: TimelinePost, author: TimelineAccount): VoiceCtx {
  const voice: Voice =
    author.kind === "team"
      ? "team"
      : author.kind === "league"
        ? "league"
        : "news";
  const a = post.attachment;
  let won: boolean | null = null;
  if (a.type === "game") {
    if (author.teamId === a.home.teamId || author.teamId === a.away.teamId) {
      won = author.teamId === a.winnerTeamId;
    }
  } else if (a.type === "performance") {
    won = author.teamId === a.team.teamId ? a.won : null;
  } else if (a.type === "playoff") {
    won = author.teamId === a.winner.teamId ? true : null;
  }
  return { voice, won };
}

function tidy(text: string): string {
  return sentenceCase(text.replace(/\s+/g, " ").trim());
}

export type RenderedVariant = { templateId: string; text: string };

/** Every template that fits this author, rendered. Used by tests and previews. */
export function renderTemplateVariants(
  post: TimelinePost,
  author: TimelineAccount,
): RenderedVariant[] {
  const { caseKey, variants } = templatesFor(post);
  const ctx = voiceContext(post, author);
  const out: RenderedVariant[] = [];
  variants.forEach((variant, index) => {
    const text = variant(ctx);
    if (text) {
      out.push({
        templateId: `${post.kind}:${caseKey}:${index}`,
        text: tidy(text),
      });
    }
  });
  return out;
}

export function composePost(
  state: GameState,
  cast: LeagueCast,
  post: TimelinePost,
  avoidTemplateId?: string | null,
): ComposedPostText {
  const saveId = String(state.meta.saveId);
  const candidates = authorCandidates(state, cast, post);
  const author = pick(candidates, hashParts(saveId, post.id, "author"));
  const { caseKey, variants } = templatesFor(post);
  const ctx = voiceContext(post, author);
  const start = hashParts(saveId, post.id, "template") % variants.length;

  let fallback: ComposedPostText | null = null;
  for (let step = 0; step < variants.length; step += 1) {
    const index = (start + step) % variants.length;
    const text = variants[index]!(ctx);
    if (!text) continue;
    const templateId = `${post.kind}:${caseKey}:${index}`;
    const composed = { authorKey: author.key, text: tidy(text), templateId };
    if (templateId !== avoidTemplateId) return composed;
    fallback ??= composed;
  }
  return (
    fallback ?? {
      authorKey: author.key,
      text: "More from around the league.",
      templateId: `${post.kind}:${caseKey}:fallback`,
    }
  );
}

export function composeTimeline(
  state: GameState,
  posts: TimelinePost[],
): ComposedPost[] {
  const cast = buildLeagueCast(state);
  const saveId = String(state.meta.saveId);
  const out: ComposedPost[] = [];
  let previous: string | null = null;
  for (const post of posts) {
    const composed = composePost(state, cast, post, previous);
    const author = cast.byKey(composed.authorKey) ?? cast.insider;
    const replies = composeReplies(state, cast, post, composed.authorKey);
    out.push({
      post,
      author,
      text: composed.text,
      templateId: composed.templateId,
      replies,
      engagement: computeEngagement(saveId, post, replies.length),
    });
    previous = composed.templateId;
  }
  return out;
}
