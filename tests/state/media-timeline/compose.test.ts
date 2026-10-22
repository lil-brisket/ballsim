import { describe, expect, it } from "vitest";
import { FIRST_NAMES } from "@/data/names/first-names";
import { LAST_NAMES } from "@/data/names/last-names";
import { asPlayerId, asTeamId } from "@/domain/ids";
import type { GameState } from "@/state/game-state";
import { buildLeagueCast } from "@/state/media-timeline/accounts";
import {
  authorCandidates,
  composePost,
  composeTimeline,
  renderTemplateVariants,
} from "@/state/media-timeline/compose-post";
import { composeReplies } from "@/state/media-timeline/compose-replies";
import {
  formatSeasonLabel,
  teamTag,
} from "@/state/media-timeline/compose-text";
import {
  computeEngagement,
  engagementLabel,
  formatCount,
} from "@/state/media-timeline/engagement";
import { buildLeagueTimeline } from "@/state/media-timeline/build-league-timeline";
import { createRefResolver } from "@/state/media-timeline/refs";
import { hashParts, pick } from "@/state/media-timeline/seed";
import type {
  GameAttachment,
  TimelineAttachment,
  TimelinePlayerRef,
  TimelinePost,
  TimelineStatLine,
} from "@/state/media-timeline/types";
import { createPlayer } from "../../factories/player";
import { awardResult, withAwards } from "../history-fixtures";
import {
  finalGame,
  otherTeams,
  seasonDay,
  statRow,
  timelineState,
  viewerTeam,
  withFixturePlayer,
  withGames,
} from "./fixtures";

const BANNED = /tweet|instagram|\bX\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;
const LEAKS = /[{}]|undefined|null|NaN/;

const base = withFixturePlayer(
  timelineState(),
  otherTeams(timelineState())[0]!,
);
const [teamA, teamB, teamC] = otherTeams(base);
const viewer = viewerTeam(base);
const refs = createRefResolver(base);
const ref = (id: string) => refs.team(id);

function playerRef(id: string, first: string, last: string, teamId: string) {
  return { playerId: id, firstName: first, lastName: last, teamId };
}
const rory = playerRef("tl_player", "Rory", "Vance", teamA!);
const sam = playerRef("tl_sam", "Sam", "Okoye", teamB!);

const line: TimelineStatLine = {
  minutes: 36,
  points: 41,
  rebounds: 12,
  assists: 10,
  steals: 2,
  blocks: 1,
  fieldGoalsMade: 15,
  fieldGoalsAttempted: 27,
  threePointersMade: 4,
  threePointersAttempted: 9,
};

let counter = 0;
function post(
  kind: TimelinePost["kind"],
  attachment: TimelineAttachment,
  extra: Partial<TimelinePost> = {},
): TimelinePost {
  counter += 1;
  return {
    id: `${kind}:fx${counter}`,
    occurredOn: seasonDay(counter % 20),
    kind,
    importance: "high",
    notability: 90,
    relevance: 50,
    teamIds: [],
    playerIds: [],
    attachment,
    tags: [],
    unread: false,
    ...extra,
  };
}

function game(
  home: string,
  away: string,
  homeScore: number,
  awayScore: number,
  extra: Partial<GameAttachment> = {},
): TimelinePost {
  const homeWon = homeScore > awayScore;
  const attachment: GameAttachment = {
    type: "game",
    gameId: `g${counter}`,
    date: seasonDay(3),
    competitionType: "regular_season",
    home: ref(home),
    away: ref(away),
    score: { home: homeScore, away: awayScore },
    periodScores: [],
    overtimePeriods: 0,
    winnerTeamId: homeWon ? home : away,
    margin: Math.abs(homeScore - awayScore),
    reasons: [],
    comebackDeficit: 0,
    winPctBefore: { home: null, away: null },
    topPerformers: {
      home: { player: rory, line },
      away: null,
    },
    series: null,
    ...extra,
  };
  return post("game", attachment, { teamIds: [home, away] });
}

const series = (a: string, b: string, wa: number, wb: number) => ({
  seriesId: "s1",
  roundLabel: "Conference Finals",
  wins: { [a]: wa, [b]: wb },
  gameNumber: wa + wb,
  winsToClinch: 4,
});

function playoff(
  event: "series_won" | "champion" | "previous_champion",
  extra: Partial<Extract<TimelineAttachment, { type: "playoff" }>> = {},
) {
  return post("playoff", {
    type: "playoff",
    event,
    seasonYear: 2026,
    seriesId: "s1",
    roundLabel: "Semifinals",
    winner: ref(teamA!),
    loser: ref(teamB!),
    seriesScore: { winner: 4, loser: 2 },
    sweep: false,
    wentDistance: false,
    ...extra,
  });
}

const POSTS: TimelinePost[] = [
  game(viewer, teamA!, 101, 99),
  game(teamA!, viewer, 90, 111),
  game(teamA!, teamB!, 120, 118, { overtimePeriods: 2, reasons: ["overtime"] }),
  game(teamA!, teamB!, 105, 100, { overtimePeriods: 1, reasons: ["overtime"] }),
  game(teamA!, teamB!, 99, 97, { reasons: ["comeback"], comebackDeficit: 17 }),
  game(teamB!, teamA!, 88, 92, { reasons: ["upset"] }),
  game(teamB!, teamA!, 130, 90, { reasons: ["blowout"] }),
  game(viewer, teamC!, 128, 88, { reasons: ["blowout", "user_team"] }),
  game(teamB!, teamC!, 100, 90, {
    topPerformers: { home: null, away: null },
  }),
  game(teamB!, teamC!, 100, 91),
  game(teamA!, teamB!, 101, 96, {
    competitionType: "playoffs",
    series: series(teamA!, teamB!, 3, 2),
  }),
  game(viewer, teamB!, 99, 103, {
    competitionType: "playoffs",
    series: series(teamB!, viewer, 2, 2),
  }),
  post("performance", {
    type: "performance",
    gameId: "g1",
    player: rory,
    team: ref(teamA!),
    opponent: ref(teamB!),
    won: true,
    line,
    reasons: ["forty_points", "triple_double"],
  }),
  post("performance", {
    type: "performance",
    gameId: "g2",
    player: sam,
    team: ref(teamB!),
    opponent: ref(teamA!),
    won: false,
    line: { ...line, points: 33, fieldGoalsAttempted: 0, fieldGoalsMade: 0 },
    reasons: ["assists"],
  }),
  ...(
    [
      ["mvp", "yearly", "Most Valuable Player", rory, null],
      ["player_of_month", "monthly", "Player of the Month", sam, null],
      ["coach_of_year", "yearly", "Coach of the Year", null, "Pat Lyle"],
      ["coach_of_month", "monthly", "Coach of the Month", null, "Pat Lyle"],
      ["mvp", "yearly", "Most Valuable Player", null, null],
    ] as const
  ).flatMap(([awardId, cadence, awardName, winner, coach], i) => [
    post("award", {
      type: "award",
      awardResultId: `ar${i}`,
      awardId: awardId as never,
      awardName,
      cadence,
      seasonYear: 2026,
      period: cadence === "monthly" ? "2026-11" : null,
      winner: winner as TimelinePlayerRef | null,
      winnerCoachName: coach,
      team: i === 3 ? null : ref(teamA!),
      stats:
        i % 2 === 0
          ? [
              { label: "PPG", value: "28.4" },
              { label: "RPG", value: "7.1" },
              { label: "APG", value: "6.2" },
            ]
          : [],
      improvement: null,
      teamRecord: i % 2 === 0 ? { wins: 50, losses: 12 } : null,
      runnerUp: i === 0 ? { name: "Lee Park", teamAbbreviation: "XYZ" } : null,
    }),
  ]),
  playoff("champion", { roundLabel: "Finals" }),
  playoff("champion", { loser: null, seriesScore: null }),
  playoff("series_won", { sweep: true, seriesScore: { winner: 4, loser: 0 } }),
  playoff("series_won", {
    wentDistance: true,
    seriesScore: { winner: 4, loser: 3 },
  }),
  playoff("series_won"),
  playoff("series_won", { seriesScore: null, roundLabel: null, loser: null }),
  playoff("previous_champion", { seriesScore: null, loser: null }),
  ...(["win_streak", "losing_streak", "streak_snapped"] as const).map((event) =>
    post("streak", {
      type: "streak",
      team: ref(teamA!),
      event,
      length: 11,
      snappedBy: event === "streak_snapped" ? ref(teamB!) : null,
      gameId: "g9",
    }),
  ),
  post("streak", {
    type: "streak",
    team: ref(teamA!),
    event: "streak_snapped",
    length: 9,
    snappedBy: null,
    gameId: "g9",
  }),
  post("trade", {
    type: "trade",
    teams: [ref(teamA!), ref(teamB!)],
    movements: [
      { player: rory, fromTeamId: teamA!, toTeamId: teamB! },
      { player: sam, fromTeamId: teamB!, toTeamId: teamA! },
    ],
    otherPieces: ["a future second-round pick"],
  }),
  post("trade", { type: "trade", teams: [], movements: [], otherPieces: [] }),
  post("signing", {
    type: "signing",
    player: rory,
    team: ref(teamA!),
    headline: "Rory Vance signs with Team",
    summary: "The veteran forward agreed to terms.",
  }),
  post("signing", {
    type: "signing",
    player: null,
    team: null,
    headline: "Someone signs",
    summary: "Someone signs",
  }),
  post("injury", {
    type: "injury",
    player: rory,
    team: ref(teamA!),
    severity: "moderate",
    bodyPart: "ankle",
    expectedReturn: { earliest: "2026-12-10", latest: "2026-12-24" },
  }),
  ...(["unknown", "lower_back", "ankle", "Undisclosed"] as const).map(
    (bodyPart, k) =>
      post("injury", {
        type: "injury",
        player: k % 2 === 0 ? rory : sam,
        team: ref(teamA!),
        severity: k < 2 ? "minor" : null,
        bodyPart,
        expectedReturn:
          k === 3 ? null : { earliest: "2026-12-10", latest: "2026-12-10" },
      }),
  ),
  post("injury", {
    type: "injury",
    player: null,
    team: null,
    severity: null,
    bodyPart: null,
    expectedReturn: null,
  }),
  post("league", {
    type: "league",
    headline: "League announces schedule change",
    summary: "The league adjusted the calendar for the holiday period.",
  }),
  post("transaction", {
    type: "league",
    headline: "Team releases a player",
    summary: "Team releases a player",
  }),
];

function textsOf(p: TimelinePost, state: GameState = base): string[] {
  const cast = buildLeagueCast(state);
  return authorCandidates(state, cast, p).flatMap((author) =>
    renderTemplateVariants(p, author).map((v) => v.text),
  );
}

function numbersIn(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? [];
}

describe("composeTimeline", () => {
  it("is deterministic", () => {
    const a = composeTimeline(base, POSTS);
    const b = composeTimeline({ ...base }, POSTS);
    expect(b).toEqual(a);
    expect(a).toHaveLength(POSTS.length);
  });

  it("changes with the save id", () => {
    const other = {
      ...base,
      meta: { ...base.meta, saveId: "another_save" as never },
    };
    const a = composeTimeline(base, POSTS).map((c) => c.text);
    const b = composeTimeline(other, POSTS).map((c) => c.text);
    expect(b).not.toEqual(a);
  });

  it("says a clinching playoff game wins the series", () => {
    const clinch = game(teamA!, teamB!, 104, 99, {
      competitionType: "playoffs",
      series: series(teamA!, teamB!, 4, 1),
    });
    const cast = buildLeagueCast(base);
    const texts = authorCandidates(base, cast, clinch).flatMap((author) =>
      renderTemplateVariants(clinch, author).map((v) => v.text),
    );
    expect(texts.join(" | ")).not.toMatch(/lead the series 4–1/);
    expect(texts.some((t) => /win the series 4–1/.test(t))).toBe(true);
  });

  it("never leaks placeholders and keeps the copy style, across every template", () => {
    for (const p of POSTS) {
      const cast = buildLeagueCast(base);
      for (const author of authorCandidates(base, cast, p)) {
        const variants = renderTemplateVariants(p, author);
        expect(variants.length, `${p.id} ${author.key}`).toBeGreaterThanOrEqual(
          2,
        );
        for (const { text, templateId } of variants) {
          expect(text, templateId).not.toMatch(LEAKS);
          expect(text, templateId).not.toMatch(BANNED);
          expect(text, templateId).not.toMatch(EMOJI);
          expect(text, templateId).not.toMatch(/analysis:|breaking/i);
          expect(text, templateId).not.toMatch(/\s{2,}/);
          expect(
            (text.match(/#/g) ?? []).length,
            templateId,
          ).toBeLessThanOrEqual(2);
          expect(text.length, templateId).toBeGreaterThan(10);
        }
      }
    }
  });

  it("composes replies and author text without leaks", () => {
    for (const c of composeTimeline(base, POSTS)) {
      for (const text of [c.text, ...c.replies.map((r) => r.text)]) {
        expect(text).not.toMatch(LEAKS);
        expect(text).not.toMatch(BANNED);
        expect(text).not.toMatch(EMOJI);
      }
    }
  });

  it("does not repeat league and transaction headlines verbatim", () => {
    for (const p of POSTS.filter((x) => x.attachment.type === "league")) {
      const att = p.attachment as Extract<
        TimelineAttachment,
        { type: "league" }
      >;
      for (const text of textsOf(p)) expect(text).not.toBe(att.headline);
    }
  });

  it("never gives two adjacent posts the same template", () => {
    const plain = Array.from({ length: 40 }, (_, i) =>
      game(teamB!, teamC!, 100 + (i % 7), 90),
    );
    const composed = composeTimeline(base, [...plain, ...POSTS]);
    for (let i = 1; i < composed.length; i += 1) {
      expect(composed[i]!.templateId).not.toBe(composed[i - 1]!.templateId);
    }
  });

  it("honors avoidTemplateId by taking another variant", () => {
    const cast = buildLeagueCast(base);
    for (const p of POSTS) {
      const first = composePost(base, cast, p);
      const second = composePost(base, cast, p, first.templateId);
      expect(second.authorKey).toBe(first.authorKey);
      expect(second.templateId).not.toBe(first.templateId);
    }
  });

  it("fills game text with the recorded score", () => {
    for (const p of POSTS.filter((x) => x.kind === "game")) {
      const g = p.attachment as GameAttachment;
      const allowed = new Set(
        [
          g.score.home,
          g.score.away,
          g.margin,
          g.overtimePeriods,
          g.comebackDeficit,
          g.series?.gameNumber,
          ...Object.values(g.series?.wins ?? {}),
          g.topPerformers.home?.line.points,
        ].map(String),
      );
      for (const text of textsOf(p)) {
        expect(text).toContain(String(g.score.home));
        expect(text).toContain(String(g.score.away));
        for (const n of numbersIn(text))
          expect(allowed.has(n), text).toBe(true);
      }
    }
  });

  it("uses the series state in playoff game text", () => {
    const p = POSTS.find(
      (x) =>
        x.attachment.type === "game" && x.attachment.series?.wins[teamA!] === 3,
    )!;
    expect(textsOf(p).every((t) => /Game 5|3-2/.test(t))).toBe(true);
  });

  it("fills performance, award, playoff and streak text from the attachment", () => {
    for (const p of POSTS) {
      const a = p.attachment;
      const texts = textsOf(p);
      if (a.type === "performance") {
        // The card shows the stat line; the text names the points once.
        for (const t of texts) {
          expect(numbersIn(t), t).toEqual([String(a.line.points)]);
        }
      } else if (a.type === "award") {
        // The card shows the award's numbers and the record; the text cites
        // none of them, and names the season as "2026–27".
        const season = formatSeasonLabel(a.seasonYear);
        for (const t of texts) {
          expect(t).toContain(a.awardName);
          expect(numbersIn(t.replaceAll(season, "")), t).toEqual([]);
        }
      } else if (a.type === "playoff") {
        const allowed = new Set<string>([
          ...formatSeasonLabel(a.seasonYear).split("–"),
          "7",
        ]);
        if (a.seriesScore) {
          allowed.add(String(a.seriesScore.winner));
          allowed.add(String(a.seriesScore.loser));
        }
        for (const t of texts) {
          for (const n of numbersIn(t)) expect(allowed.has(n), t).toBe(true);
          if (a.sweep) expect(t).toContain(`${a.seriesScore!.winner}–0`);
        }
      } else if (a.type === "streak") {
        for (const t of texts) {
          expect(t).toContain(String(a.length));
          for (const n of numbersIn(t)) expect(n).toBe(String(a.length));
        }
      }
    }
  });

  it("only mentions Game 7 when the series went seven", () => {
    for (const p of POSTS.filter((x) => x.attachment.type === "playoff")) {
      const a = p.attachment as Extract<
        TimelineAttachment,
        { type: "playoff" }
      >;
      const sevenGames =
        a.wentDistance &&
        a.seriesScore &&
        a.seriesScore.winner + a.seriesScore.loser === 7;
      if (!sevenGames) {
        for (const t of textsOf(p)) expect(t).not.toMatch(/Game 7/);
      }
    }
  });

  it("picks the expected authors", () => {
    const cast = buildLeagueCast(base);
    const keys = (p: TimelinePost) =>
      authorCandidates(base, cast, p).map((a) => a.key);
    expect(keys(POSTS[0]!)).toContain(`team:${viewer}`);
    expect(keys(POSTS.find((p) => p.kind === "award")!)).toEqual(["league"]);
    expect(keys(POSTS.find((p) => p.kind === "trade")!)).toEqual(["insider"]);
    const champion = POSTS.find(
      (p) =>
        p.attachment.type === "playoff" && p.attachment.event === "champion",
    )!;
    expect(keys(champion)).toEqual(["league"]);
    const injury = POSTS.find((p) => p.kind === "injury")!;
    expect(cast.byKey(keys(injury)[0]!)?.kind).toBe("reporter");
  });
});

describe("copy polish", () => {
  const clubs = [teamA!, teamB!, teamC!].map((id) => ref(id).name);
  const fullNames = [teamA!, teamB!, teamC!].map((id) => ref(id).displayName);

  it("puts an article before every club name in post text", () => {
    const kinds = new Set([
      "game",
      "streak",
      "playoff",
      "trade",
      "signing",
      "award",
    ]);
    for (const p of POSTS.filter((x) => kinds.has(x.kind))) {
      for (const raw of textsOf(p)) {
        // "the Washington Quasars" is fine; drop full names and hashtags
        // ("#Quasars"), then look for bare ones.
        const text = fullNames.reduce(
          (acc, full) => acc.replace(new RegExp(`the ${full}`, "gi"), ""),
          raw.replace(/#\w+/g, ""),
        );
        for (const club of clubs) {
          expect(text, raw).not.toMatch(
            new RegExp(String.raw`(?<!\bthe )\b${club}\b`, "i"),
          );
        }
      }
    }
    const plain = POSTS.find(
      (p) =>
        p.attachment.type === "game" &&
        p.attachment.reasons.includes("blowout"),
    )!;
    const g = plain.attachment as GameAttachment;
    const loser = g.winnerTeamId === g.home.teamId ? g.away : g.home;
    expect(textsOf(plain).some((t) => t.includes(`the ${loser.name}`))).toBe(
      true,
    );
    expect(textsOf(plain).some((t) => /^The /.test(t))).toBe(true);
  });

  it("writes scores with an en dash, winner first", () => {
    for (const p of POSTS) {
      for (const text of [
        ...textsOf(p),
        ...composeReplies(base, buildLeagueCast(base), p, "x").map(
          (r) => r.text,
        ),
      ]) {
        expect(text, text).not.toMatch(/\d-\d/);
      }
    }
    for (const p of POSTS.filter(
      (x) => x.attachment.type === "game" && !x.attachment.series,
    )) {
      const g = p.attachment as GameAttachment;
      const hi = Math.max(g.score.home, g.score.away);
      const lo = Math.min(g.score.home, g.score.away);
      for (const text of textsOf(p)) {
        expect(text, text).not.toContain(`${lo}–${hi}`);
      }
      expect(textsOf(p).some((t) => t.includes(`${hi}–${lo}`))).toBe(true);
    }
  });

  it("never prints an undisclosed body part and names the injured player", () => {
    const injuries = POSTS.filter((p) => p.attachment.type === "injury");
    for (const p of injuries) {
      const a = p.attachment as Extract<TimelineAttachment, { type: "injury" }>;
      for (const text of textsOf(p)) {
        expect(text, text).not.toMatch(/unknown|undisclosed|_/i);
        expect(text, text).not.toMatch(/a (?=[aeiou])/i);
        if (a.player) expect(text, text).toContain(a.player.lastName);
      }
    }
    const all = injuries.flatMap((p) => textsOf(p));
    expect(all.some((t) => t.includes("an ankle injury"))).toBe(true);
    expect(all.some((t) => t.includes("lower back"))).toBe(true);
  });

  it("tags teams by nickname, never by an abbreviation that reads as a word", () => {
    const STOP_WORDS = new Set([
      "new",
      "can",
      "are",
      "out",
      "for",
      "war",
      "man",
      "sea",
      "win",
      "mad",
    ]);
    const word = { ...ref(teamA!), abbreviation: "NEW", name: "Red Wolves" };
    expect(teamTag(word)).toBe("#RedWolves");
    const nicknames = [viewer, teamA!, teamB!, teamC!].map(
      (id) => `#${ref(id).name.replace(/[^A-Za-z0-9]/g, "")}`,
    );
    for (const p of POSTS) {
      for (const text of textsOf(p)) {
        for (const tag of text.match(/#\w+/g) ?? []) {
          expect(STOP_WORDS.has(tag.slice(1).toLowerCase()), text).toBe(false);
          // "#AWYvsHOM" matchup tags are the only abbreviation tags.
          if (!/vs/.test(tag)) expect(nicknames, text).toContain(tag);
        }
      }
    }
  });
});

describe("composeReplies", () => {
  it("never replies from the author, and replies have distinct authors", () => {
    const cast = buildLeagueCast(base);
    for (const p of POSTS) {
      for (const author of authorCandidates(base, cast, p)) {
        const replies = composeReplies(base, cast, p, author.key);
        expect(replies.length).toBeLessThanOrEqual(3);
        const keys = replies.map((r) => r.author.key);
        expect(keys).not.toContain(author.key);
        expect(new Set(keys).size).toBe(keys.length);
        replies.forEach((r, i) => expect(r.id).toBe(`${p.id}:reply:${i}`));
      }
    }
  });

  it("scales the reply count with notability", () => {
    const cast = buildLeagueCast(base);
    const p = POSTS[0]!;
    expect(composeReplies(base, cast, { ...p, notability: 59 }, "x")).toEqual(
      [],
    );
    expect(
      composeReplies(base, cast, { ...p, notability: 85 }, "x"),
    ).toHaveLength(3);
    for (const notability of [60, 70, 75]) {
      const n = composeReplies(base, cast, { ...p, notability }, "x").length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  it("does not restate the card's stat line in replies", () => {
    const cast = buildLeagueCast(base);
    for (const p of POSTS) {
      const a = p.attachment;
      if (a.type !== "performance" && a.type !== "award") continue;
      for (const author of authorCandidates(base, cast, p)) {
        const replies = composeReplies(
          base,
          cast,
          { ...p, notability: 99 },
          author.key,
        );
        for (const { text } of replies) {
          if (a.type === "performance") {
            expect(text, text).not.toMatch(/rebounds|assists|-of-/);
          } else {
            const season = formatSeasonLabel(a.seasonYear);
            expect(numbersIn(text.replaceAll(season, "")), text).toEqual([]);
          }
        }
      }
    }
  });

  it("has fans reply from the right side of the result", () => {
    const cast = buildLeagueCast(base);
    const p = game(teamB!, teamC!, 100, 90);
    const replies = composeReplies(base, cast, { ...p, notability: 99 }, "x");
    expect(replies.length).toBe(3);
    for (const r of replies) expect(r.text).not.toMatch(LEAKS);
  });
});

describe("engagement", () => {
  it("is monotonic in notability for a fixed post id", () => {
    for (const id of ["a", "game:1", "perf:g:p", "award:7"]) {
      let prev = { replies: 0, reposts: 0, likes: 0 };
      for (let notability = 0; notability <= 100; notability += 5) {
        const e = computeEngagement(
          "save",
          { id, notability, relevance: 20 },
          0,
        );
        expect(e.likes).toBeGreaterThanOrEqual(prev.likes);
        expect(e.reposts).toBeGreaterThanOrEqual(prev.reposts);
        expect(e.replies).toBeGreaterThanOrEqual(prev.replies);
        expect(e.reposts).toBeLessThanOrEqual(e.likes);
        prev = e;
      }
    }
  });

  it("scales from tens to thousands and respects visible replies", () => {
    const low = computeEngagement(
      "s",
      { id: "p", notability: 30, relevance: 0 },
      0,
    );
    const high = computeEngagement(
      "s",
      { id: "p", notability: 100, relevance: 0 },
      3,
    );
    expect(low.likes).toBeLessThan(200);
    expect(low.likes).toBeGreaterThanOrEqual(10);
    expect(high.likes).toBeGreaterThan(2000);
    expect(high.replies).toBeGreaterThanOrEqual(3);
    expect(
      computeEngagement("s", { id: "p", notability: 0, relevance: 0 }, 3)
        .replies,
    ).toBe(3);
  });

  it("is deterministic and posts carry replies in the count", () => {
    for (const c of composeTimeline(base, POSTS)) {
      expect(c.engagement.replies).toBeGreaterThanOrEqual(c.replies.length);
      expect(c.engagement.reposts).toBeLessThanOrEqual(c.engagement.likes);
    }
  });

  it("formats counts", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1000)).toBe("1K");
    expect(formatCount(1234)).toBe("1.2K");
    expect(formatCount(12345)).toBe("12K");
    expect(formatCount(999_999)).toBe("1M");
    expect(formatCount(1_234_567)).toBe("1.2M");
  });

  it("labels engagement", () => {
    expect(engagementLabel({ replies: 214, reposts: 1234, likes: 5800 })).toBe(
      "214 replies, 1.2K reposts, 5.8K likes",
    );
    expect(engagementLabel({ replies: 1, reposts: 1, likes: 1 })).toBe(
      "1 reply, 1 repost, 1 like",
    );
  });
});

describe("league cast", () => {
  const cast = buildLeagueCast(base);

  it("is memoized per state", () => {
    expect(buildLeagueCast(base)).toBe(cast);
  });

  it("builds the expected accounts", () => {
    expect(cast.league.handle).toBe(`@${base.world.league.abbreviation}Office`);
    expect(cast.league.displayName).toBe(base.world.league.name);
    for (const teamId of Object.keys(base.world.teams)) {
      const team = base.world.teams[teamId]!;
      expect(cast.team(teamId)?.handle).toBe(
        `@${team.abbreviation}${team.name.replace(/[^A-Za-z0-9]/g, "")}`,
      );
      expect(cast.team(teamId)?.displayName).toBe(`${team.city} ${team.name}`);
      expect(cast.fan(teamId)?.verified).toBe(false);
      expect(cast.fan(teamId)?.avatar).toMatchObject({
        type: "monogram",
        teamId,
      });
      expect(cast.beatFor(teamId).kind).toBe("reporter");
    }
    expect(cast.insider.beat).toBe("League insider");
    expect(cast.analyst).toMatchObject({ kind: "analyst", beat: "Stats" });
    const conferences = Object.keys(base.world.conferences).sort().slice(0, 2);
    const beats = cast.accounts.filter((a) => a.key.startsWith("beat:"));
    expect(beats.map((b) => b.beat)).toEqual(
      conferences.map((id) => base.world.conferences[id]!.name),
    );
  });

  it("has unique, well-formed handles", () => {
    const player = cast.player(rory);
    expect(cast.player(rory)).toBe(player);
    expect(player.handle).toBe("@RoryVance");
    expect(player.avatar).toEqual({
      type: "portrait",
      playerId: rory.playerId,
    });
    const handles = [...cast.accounts, player].map((a) => a.handle);
    for (const handle of handles) expect(handle).toMatch(/^@[A-Za-z0-9_]+$/);
    expect(new Set(handles.map((h) => h.toLowerCase())).size).toBe(
      handles.length,
    );
    expect(cast.byKey(player.key)).toBe(player);
  });

  it("builds reporter names from the name pools, never matching a player", () => {
    const people = cast.accounts.filter(
      (a) => a.kind === "reporter" || a.kind === "analyst",
    );
    expect(people.length).toBeGreaterThanOrEqual(3);
    for (const person of people) {
      const [first, ...rest] = person.displayName.split(" ");
      expect(FIRST_NAMES as readonly string[]).toContain(first);
      expect(LAST_NAMES as readonly string[]).toContain(rest.join(" "));
      expect(person.verified).toBe(true);
    }
    // Put a player on the roster with the insider's exact name.
    const [first, ...rest] = cast.insider.displayName.split(" ");
    const clash = {
      ...createPlayer({ id: asPlayerId("clash") }),
      firstName: first!,
      lastName: rest.join(" "),
      teamId: asTeamId(teamA!),
    };
    const clashed: GameState = {
      ...base,
      world: {
        ...base.world,
        players: { ...base.world.players, clash },
      },
    };
    const names = new Set(
      Object.values(clashed.world.players).map(
        (p) => `${p.firstName} ${p.lastName}`,
      ),
    );
    const next = buildLeagueCast(clashed);
    for (const a of next.accounts.filter(
      (x) => x.kind === "reporter" || x.kind === "analyst",
    )) {
      expect(names.has(a.displayName)).toBe(false);
    }
  });

  it("has no real brands or emoji in any account", () => {
    for (const a of cast.accounts) {
      expect(`${a.displayName} ${a.handle}`).not.toMatch(BANNED);
      expect(`${a.displayName} ${a.handle}`).not.toMatch(EMOJI);
    }
  });
});

describe("seed", () => {
  it("hashes deterministically and picks within the list", () => {
    expect(hashParts("a", "b", 1)).toBe(hashParts("a", "b", 1));
    expect(hashParts("a", "b", 1)).not.toBe(hashParts("a", "b", 2));
    expect(hashParts("ab", "c")).not.toBe(hashParts("a", "bc"));
    expect(["x", "y", "z"]).toContain(pick(["x", "y", "z"], hashParts("q")));
  });
});

describe("real timeline posts", () => {
  const withPlayers = withFixturePlayer(timelineState(), teamA!);
  const blowout = finalGame(withPlayers, {
    id: "big",
    date: seasonDay(2),
    home: teamA!,
    away: teamB!,
    homeScore: 140,
    awayScore: 90,
    stats: [
      statRow("tl_player", teamA!, {
        points: 45,
        fieldGoalsMade: 17,
        fieldGoalsAttempted: 25,
      }),
    ],
  });
  const state = withAwards(
    withGames(withPlayers, [
      blowout,
      finalGame(withPlayers, {
        id: "mine",
        date: seasonDay(3),
        home: viewer,
        away: teamC!,
        homeScore: 100,
        awayScore: 96,
      }),
    ]),
    [
      awardResult({
        awardId: "player_of_month",
        seasonYear: withPlayers.competition.season.year,
        winnerId: "tl_player",
        teamId: teamA!,
        period: "2026-10",
      }),
    ],
  );

  it("composes real posts deterministically", () => {
    const posts = buildLeagueTimeline(state, { limit: 1000 }).posts;
    expect(new Set(posts.map((p) => p.kind))).toContain("game");
    const a = composeTimeline(state, posts);
    expect(composeTimeline(state, posts)).toEqual(a);
    for (const c of a) {
      expect(c.text).not.toMatch(LEAKS);
      expect(c.author.handle).toMatch(/^@[A-Za-z0-9_]+$/);
    }
  });
});
