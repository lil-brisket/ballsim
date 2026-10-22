/**
 * Hand-written, fully fictional timeline data for /dev/media-showcase. Covers
 * every attachment type, author kind, reply count and engagement size. Teams
 * HAR (very dark primary) and SUM (very light primary) mirror the
 * broadcast-ui showcase. Numbers in each post's text match its attachment.
 */

import type {
  TimelineDisplayContext,
  TimelinePostView,
} from "@/state/media-timeline/post-view";
import type { TimelineAccount } from "@/state/media-timeline/accounts";
import type { ComposedReply } from "@/state/media-timeline/compose-replies";
import {
  engagementLabel,
  formatCount,
  type Engagement,
} from "@/state/media-timeline/engagement";
import type {
  GameAttachment,
  TimelineAttachment,
  TimelinePlayerRef,
  TimelinePostKind,
  TimelineStatLine,
  TimelineTeamRef,
} from "@/state/media-timeline/types";

const SAVE_ID = "showcase";

function team(
  teamId: string,
  abbreviation: string,
  city: string,
  name: string,
): TimelineTeamRef {
  return {
    teamId,
    abbreviation,
    displayName: `${city} ${name}`,
    name,
    branding: null,
  };
}

const HAR = team("har", "HAR", "Harbor", "Lights");
const SUM = team("sum", "SUM", "Summit", "Peaks");
const CRG = team("crg", "CRG", "Copper Ridge", "Foxes");
const LKS = team("lks", "LKS", "Lakeshore", "Tides");

export const SHOWCASE_CONTEXT: TimelineDisplayContext = {
  saveId: SAVE_ID,
  teams: {
    har: {
      branding: {
        primaryColor: "#0B1F3A",
        secondaryColor: "#C4CED4",
        accentColor: "#F5B800",
        logoId: "wolf",
      },
      href: `/dashboard/${SAVE_ID}/teams/har`,
    },
    sum: {
      branding: {
        primaryColor: "#F2F0E6",
        secondaryColor: "#1D6B44",
        accentColor: "#C8102E",
        logoId: "eagle",
      },
      href: `/dashboard/${SAVE_ID}/teams/sum`,
    },
    crg: {
      branding: {
        primaryColor: "#B4532A",
        secondaryColor: "#2B2118",
        accentColor: "#F4C95D",
        logoId: "falcon",
      },
      href: `/dashboard/${SAVE_ID}/teams/crg`,
    },
    lks: {
      branding: {
        primaryColor: "#1D6FA5",
        secondaryColor: "#E8F1F5",
        accentColor: "#FF7A3D",
        logoId: "bear",
      },
      href: `/dashboard/${SAVE_ID}/teams/lks`,
    },
  },
  // No generated portrait for anyone: avatars fall back to initials.
  portraits: {
    p_valdane: null,
    p_pryce: null,
    p_kessler: null,
    p_strand: null,
    p_brandt: null,
    p_tamaki: null,
    p_farrell: null,
    p_okafor: null,
  },
};

function player(
  playerId: string,
  firstName: string,
  lastName: string,
  teamId: string | null,
): TimelinePlayerRef {
  return { playerId, firstName, lastName, teamId };
}

const VALDANE = player("p_valdane", "Teo", "Valdane", "har");
const PRYCE = player("p_pryce", "Jonah", "Pryce", "sum");
const KESSLER = player("p_kessler", "Dario", "Kessler", "crg");
const STRAND = player("p_strand", "Imani", "Strand", "lks");
const BRANDT = player("p_brandt", "Luca", "Brandt", "har");
const TAMAKI = player("p_tamaki", "Wes", "Tamaki", "sum");
const FARRELL = player("p_farrell", "Niko", "Farrell", "crg");
const OKAFOR = player("p_okafor", "Ravi", "Okafor", "lks");

function line(
  points: number,
  rebounds: number,
  assists: number,
  extra: Partial<TimelineStatLine> = {},
): TimelineStatLine {
  return {
    minutes: 34,
    points,
    rebounds,
    assists,
    steals: 1,
    blocks: 0,
    fieldGoalsMade: Math.round(points / 2.3),
    fieldGoalsAttempted: Math.round(points / 1.2),
    threePointersMade: 2,
    threePointersAttempted: 6,
    ...extra,
  };
}

function account(
  kind: TimelineAccount["kind"],
  displayName: string,
  handle: string,
  overrides: Partial<TimelineAccount> = {},
): TimelineAccount {
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
  return {
    key: `${kind}:${handle}`,
    kind,
    displayName,
    handle,
    verified: kind !== "fan",
    teamId: null,
    playerId: null,
    beat: null,
    avatar: { type: "monogram", initials, teamId: null },
    ...overrides,
  };
}

const LEAGUE_ACCOUNT = account("league", "Premier Hoops League", "@PHLOffice", {
  avatar: { type: "league", letters: "PHL" },
});
const HAR_ACCOUNT = account("team", "Harbor Lights", "@HarborLights", {
  teamId: "har",
  avatar: { type: "logo", teamId: "har" },
});
const SUM_ACCOUNT = account("team", "Summit Peaks", "@SummitPeaks", {
  teamId: "sum",
  avatar: { type: "logo", teamId: "sum" },
});
const REPORTER = account("reporter", "Marta Ellingsen", "@MartaEllingsen", {
  beat: "League insider",
});
const ANALYST = account("analyst", "Corwin Aldous", "@CorwinAldous", {
  beat: "Stats",
});
const HAR_FAN = account("fan", "Lights Faithful", "@LightsFaithful", {
  teamId: "har",
  avatar: { type: "monogram", initials: "LF", teamId: "har" },
});
const SUM_FAN = account("fan", "Summit Hoops Talk", "@SummitHoopsTalk", {
  teamId: "sum",
  avatar: { type: "monogram", initials: "SH", teamId: "sum" },
});
const LKS_FAN = account("fan", "Die-hard Tides", "@DiehardTides", {
  teamId: "lks",
  avatar: { type: "monogram", initials: "DT", teamId: "lks" },
});

function playerAccount(ref: TimelinePlayerRef): TimelineAccount {
  return account(
    "player",
    `${ref.firstName} ${ref.lastName}`,
    `@${ref.firstName}${ref.lastName}`,
    {
      key: `player:${ref.playerId}`,
      teamId: ref.teamId,
      playerId: ref.playerId,
      avatar: { type: "portrait", playerId: ref.playerId },
    },
  );
}

function reply(
  postId: string,
  index: number,
  author: TimelineAccount,
  text: string,
): ComposedReply {
  return { id: `${postId}:reply:${index}`, author, text };
}

type PostSpec = {
  id: string;
  kind: TimelinePostKind;
  occurredOn: string;
  dateLabel: string;
  relativeLabel: string;
  unread: boolean;
  author: TimelineAccount;
  text: string;
  replies?: ComposedReply[];
  engagement: Engagement;
  attachment: TimelineAttachment;
  boxScoreHref?: string;
};

function post(spec: PostSpec): TimelinePostView {
  const replies = spec.replies ?? [];
  return {
    id: spec.id,
    kind: spec.kind,
    occurredOn: spec.occurredOn,
    dateLabel: spec.dateLabel,
    relativeLabel: spec.relativeLabel,
    unread: spec.unread,
    author: spec.author,
    text: spec.text,
    replies,
    engagement: spec.engagement,
    engagementDisplay: {
      replies: formatCount(spec.engagement.replies),
      reposts: formatCount(spec.engagement.reposts),
      likes: formatCount(spec.engagement.likes),
    },
    engagementLabel: engagementLabel(spec.engagement),
    attachment: spec.attachment,
    boxScoreHref: spec.boxScoreHref ?? null,
  };
}

const NO_WINPCT = { home: null, away: null } as const;

function game(
  overrides: Partial<GameAttachment> &
    Pick<
      GameAttachment,
      "gameId" | "date" | "home" | "away" | "score" | "winnerTeamId"
    >,
): GameAttachment {
  const margin = Math.abs(overrides.score.home - overrides.score.away);
  return {
    type: "game",
    competitionType: "regular_season",
    periodScores: [],
    overtimePeriods: 0,
    margin,
    reasons: [],
    comebackDeficit: 0,
    winPctBefore: { ...NO_WINPCT },
    topPerformers: { home: null, away: null },
    series: null,
    ...overrides,
  };
}

const GAME_USER_WIN = game({
  gameId: "g1",
  date: "2026-10-20",
  home: HAR,
  away: SUM,
  score: { home: 108, away: 97 },
  winnerTeamId: "har",
  reasons: ["user_team"],
  periodScores: [
    { home: 28, away: 22 },
    { home: 25, away: 27 },
    { home: 29, away: 24 },
    { home: 26, away: 24 },
  ],
  topPerformers: {
    home: { player: VALDANE, line: line(31, 9, 6) },
    away: { player: PRYCE, line: line(24, 7, 5) },
  },
});

const GAME_DOUBLE_OT = game({
  gameId: "g2",
  date: "2026-10-19",
  home: CRG,
  away: LKS,
  score: { home: 120, away: 117 },
  winnerTeamId: "crg",
  competitionType: "regular_season",
  overtimePeriods: 2,
  reasons: ["overtime"],
  periodScores: [
    { home: 25, away: 22 },
    { home: 24, away: 27 },
    { home: 26, away: 25 },
    { home: 23, away: 24 },
    { home: 10, away: 10 },
    { home: 12, away: 9 },
  ],
  topPerformers: {
    home: { player: KESSLER, line: line(38, 11, 7, { minutes: 47 }) },
    away: { player: STRAND, line: line(35, 8, 9, { minutes: 46 }) },
  },
});

const GAME_PLAYOFF = game({
  gameId: "g3",
  date: "2026-10-18",
  home: SUM,
  away: HAR,
  score: { home: 101, away: 104 },
  winnerTeamId: "har",
  competitionType: "playoffs",
  reasons: ["playoff", "user_team"],
  periodScores: [
    { home: 24, away: 26 },
    { home: 25, away: 27 },
    { home: 28, away: 25 },
    { home: 24, away: 26 },
  ],
  topPerformers: {
    home: { player: PRYCE, line: line(29, 8, 4) },
    away: { player: VALDANE, line: line(33, 7, 8) },
  },
  series: {
    seriesId: "s_har_sum",
    roundLabel: "Conference Finals",
    wins: { har: 3, sum: 2 },
    gameNumber: 5,
    winsToClinch: 4,
  },
});

const GAME_ONE_SIDED = game({
  gameId: "g4",
  date: "2026-10-17",
  home: SUM,
  away: LKS,
  score: { home: 92, away: 88 },
  winnerTeamId: "sum",
  periodScores: [
    { home: 23, away: 20 },
    { home: 22, away: 24 },
    { home: 24, away: 22 },
    { home: 23, away: 22 },
  ],
  topPerformers: {
    home: { player: TAMAKI, line: line(22, 12, 3) },
    away: null,
  },
});

export const SHOWCASE_POSTS: TimelinePostView[] = [
  post({
    id: "showcase-game-win",
    kind: "game",
    occurredOn: "2026-10-20",
    dateLabel: "Oct 20",
    relativeLabel: "Today",
    unread: true,
    author: HAR_ACCOUNT,
    text: "FINAL: Harbor Lights 108, Summit Peaks 97. Teo Valdane led the way with 31.",
    replies: [
      reply("showcase-game-win", 0, HAR_FAN, "Let's go Lights! 108–97."),
      reply("showcase-game-win", 1, SUM_FAN, "Tough one to swallow. 108–97."),
      reply(
        "showcase-game-win",
        2,
        playerAccount(VALDANE),
        "Great team win, 108–97. Proud of this group.",
      ),
    ],
    engagement: { replies: 214, reposts: 1200, likes: 12400 },
    attachment: GAME_USER_WIN,
    boxScoreHref: `/dashboard/${SAVE_ID}/games/g1`,
  }),
  post({
    id: "showcase-game-2ot",
    kind: "game",
    occurredOn: "2026-10-19",
    dateLabel: "Oct 19",
    relativeLabel: "1d",
    unread: true,
    author: REPORTER,
    text: "Double overtime in Copper Ridge. The Foxes edge the Tides 120–117 after Dario Kessler scores 38.",
    replies: [
      reply("showcase-game-2ot", 0, LKS_FAN, "Back to work, Tides. 120–117."),
    ],
    engagement: { replies: 96, reposts: 410, likes: 3800 },
    attachment: GAME_DOUBLE_OT,
    boxScoreHref: `/dashboard/${SAVE_ID}/games/g2`,
  }),
  post({
    id: "showcase-game-playoff",
    kind: "game",
    occurredOn: "2026-10-18",
    dateLabel: "Oct 18",
    relativeLabel: "2d",
    unread: false,
    author: ANALYST,
    text: "Harbor Lights 104, Summit Peaks 101. HAR now leads the Conference Finals 3–2 and is one win from the Finals.",
    engagement: { replies: 58, reposts: 220, likes: 2100 },
    attachment: GAME_PLAYOFF,
  }),
  post({
    id: "showcase-game-null-performer",
    kind: "game",
    occurredOn: "2026-10-17",
    dateLabel: "Oct 17",
    relativeLabel: "3d",
    unread: false,
    author: SUM_ACCOUNT,
    text: "A grind-it-out win at home, 92–88 over Lakeshore. Wes Tamaki had 22 and 12.",
    engagement: { replies: 4, reposts: 6, likes: 41 },
    attachment: GAME_ONE_SIDED,
  }),
  post({
    id: "showcase-performance",
    kind: "performance",
    occurredOn: "2026-10-19",
    dateLabel: "Oct 19",
    relativeLabel: "1d",
    unread: true,
    author: playerAccount(KESSLER),
    text: "42 points tonight. Credit to my teammates.",
    replies: [
      reply(
        "showcase-performance",
        0,
        ANALYST,
        "16-of-25 from the field is the story behind 42 points.",
      ),
    ],
    engagement: { replies: 140, reposts: 880, likes: 7600 },
    attachment: {
      type: "performance",
      gameId: "g2",
      player: KESSLER,
      team: CRG,
      opponent: LKS,
      won: true,
      line: line(42, 11, 7, {
        minutes: 41,
        fieldGoalsMade: 16,
        fieldGoalsAttempted: 25,
        threePointersMade: 5,
        threePointersAttempted: 9,
      }),
      reasons: ["forty_points", "season_high"],
    },
  }),
  post({
    id: "showcase-award-monthly",
    kind: "award",
    occurredOn: "2026-10-16",
    dateLabel: "Oct 16",
    relativeLabel: "4d",
    unread: false,
    author: LEAGUE_ACCOUNT,
    text: "Teo Valdane of the Harbor Lights is the Player of the Month for October.",
    engagement: { replies: 33, reposts: 150, likes: 1900 },
    attachment: {
      type: "award",
      awardResultId: "ar1",
      awardId: "player_of_month",
      awardName: "Player of the Month",
      cadence: "monthly",
      seasonYear: 2026,
      period: "2026-10",
      winner: VALDANE,
      winnerCoachName: null,
      team: HAR,
      stats: [
        { label: "PPG", value: "28.4" },
        { label: "RPG", value: "8.1" },
        { label: "APG", value: "6.3" },
      ],
      improvement: null,
      teamRecord: { wins: 9, losses: 2 },
      runnerUp: { name: "Jonah Pryce", teamAbbreviation: "SUM" },
    },
  }),
  post({
    id: "showcase-award-mvp",
    kind: "award",
    occurredOn: "2026-10-15",
    dateLabel: "Oct 15",
    relativeLabel: "5d",
    unread: false,
    author: LEAGUE_ACCOUNT,
    text: "Jonah Pryce of the Summit Peaks is the 2025–26 Most Valuable Player.",
    replies: [
      reply("showcase-award-mvp", 0, SUM_FAN, "Well deserved, Jonah Pryce."),
      reply(
        "showcase-award-mvp",
        1,
        playerAccount(PRYCE),
        "Honored. Thank you to my teammates and coaches.",
      ),
    ],
    engagement: { replies: 520, reposts: 3100, likes: 12400 },
    attachment: {
      type: "award",
      awardResultId: "ar2",
      awardId: "mvp",
      awardName: "Most Valuable Player",
      cadence: "yearly",
      seasonYear: 2025,
      period: null,
      winner: PRYCE,
      winnerCoachName: null,
      team: SUM,
      stats: [
        { label: "PPG", value: "30.2" },
        { label: "RPG", value: "7.4" },
        { label: "APG", value: "5.9" },
      ],
      improvement: null,
      teamRecord: { wins: 61, losses: 21 },
      runnerUp: { name: "Teo Valdane", teamAbbreviation: "HAR" },
    },
  }),
  post({
    id: "showcase-award-coach",
    kind: "award",
    occurredOn: "2026-10-14",
    dateLabel: "Oct 14",
    relativeLabel: "6d",
    unread: false,
    author: REPORTER,
    text: "Dale Whitcombe wins Coach of the Year after a turnaround season in Harbor.",
    engagement: { replies: 12, reposts: 40, likes: 610 },
    attachment: {
      type: "award",
      awardResultId: "ar3",
      awardId: "coach_of_year",
      awardName: "Coach of the Year",
      cadence: "yearly",
      seasonYear: 2025,
      period: null,
      winner: null,
      winnerCoachName: "Dale Whitcombe",
      team: HAR,
      stats: [
        { label: "Record", value: "58–24" },
        { label: "Wins vs last season", value: "+17", tone: "win" },
        { label: "League rank", value: "2nd" },
      ],
      improvement: 17,
      teamRecord: { wins: 58, losses: 24 },
      runnerUp: null,
    },
  }),
  post({
    id: "showcase-playoff-sweep",
    kind: "playoff",
    occurredOn: "2026-10-12",
    dateLabel: "Oct 12",
    relativeLabel: "Oct 12",
    unread: false,
    author: HAR_ACCOUNT,
    text: "Swept. Harbor Lights beat Copper Ridge 4–0 in the First Round.",
    engagement: { replies: 80, reposts: 260, likes: 2800 },
    attachment: {
      type: "playoff",
      event: "series_won",
      seasonYear: 2026,
      seriesId: "s1",
      roundLabel: "First Round",
      winner: HAR,
      loser: CRG,
      seriesScore: { winner: 4, loser: 0 },
      sweep: true,
      wentDistance: false,
    },
  }),
  post({
    id: "showcase-playoff-game7",
    kind: "playoff",
    occurredOn: "2026-10-12",
    dateLabel: "Oct 12",
    relativeLabel: "Oct 12",
    unread: false,
    author: ANALYST,
    text: "Game 7 goes to Summit. The Peaks beat the Tides 4–3 to move on.",
    replies: [
      reply("showcase-playoff-game7", 0, LKS_FAN, "Back to work, Tides. 4–3."),
    ],
    engagement: { replies: 310, reposts: 940, likes: 6200 },
    attachment: {
      type: "playoff",
      event: "series_won",
      seasonYear: 2026,
      seriesId: "s2",
      roundLabel: "Second Round",
      winner: SUM,
      loser: LKS,
      seriesScore: { winner: 4, loser: 3 },
      sweep: false,
      wentDistance: true,
    },
  }),
  post({
    id: "showcase-playoff-champion",
    kind: "playoff",
    occurredOn: "2026-06-20",
    dateLabel: "Jun 20",
    relativeLabel: "Jun 20",
    unread: true,
    author: LEAGUE_ACCOUNT,
    text: "The Harbor Lights are the 2025–26 champions, beating Summit 4–2 in the Finals.",
    replies: [
      reply("showcase-playoff-champion", 0, HAR_FAN, "Let's go Lights! 4–2."),
      reply(
        "showcase-playoff-champion",
        1,
        REPORTER,
        "The Harbor Lights are the 2025 champions.",
      ),
      reply(
        "showcase-playoff-champion",
        2,
        SUM_FAN,
        "Tough one to swallow. 4–2.",
      ),
    ],
    engagement: { replies: 2400, reposts: 18000, likes: 96000 },
    attachment: {
      type: "playoff",
      event: "champion",
      seasonYear: 2025,
      seriesId: "s3",
      roundLabel: "Finals",
      winner: HAR,
      loser: SUM,
      seriesScore: { winner: 4, loser: 2 },
      sweep: false,
      wentDistance: false,
    },
  }),
  post({
    id: "showcase-playoff-previous",
    kind: "playoff",
    occurredOn: "2026-10-10",
    dateLabel: "Oct 10",
    relativeLabel: "Oct 10",
    unread: false,
    author: SUM_ACCOUNT,
    text: "Defending champions open the new season tonight.",
    engagement: { replies: 9, reposts: 22, likes: 300 },
    attachment: {
      type: "playoff",
      event: "previous_champion",
      seasonYear: 2025,
      seriesId: null,
      roundLabel: null,
      winner: HAR,
      loser: null,
      seriesScore: null,
      sweep: false,
      wentDistance: false,
    },
  }),
  post({
    id: "showcase-streak-win",
    kind: "streak",
    occurredOn: "2026-10-20",
    dateLabel: "Oct 20",
    relativeLabel: "Today",
    unread: true,
    author: HAR_FAN,
    text: "9 straight wins for Harbor. Nobody wants to see us right now.",
    engagement: { replies: 3, reposts: 1, likes: 3 },
    attachment: {
      type: "streak",
      team: HAR,
      event: "win_streak",
      length: 9,
      snappedBy: null,
      gameId: "g1",
    },
  }),
  post({
    id: "showcase-streak-losing",
    kind: "streak",
    occurredOn: "2026-10-19",
    dateLabel: "Oct 19",
    relativeLabel: "1d",
    unread: false,
    author: REPORTER,
    text: "The Tides have lost 6 in a row and are looking for answers.",
    engagement: { replies: 45, reposts: 38, likes: 520 },
    attachment: {
      type: "streak",
      team: LKS,
      event: "losing_streak",
      length: 6,
      snappedBy: null,
      gameId: "g2",
    },
  }),
  post({
    id: "showcase-streak-snapped",
    kind: "streak",
    occurredOn: "2026-10-18",
    dateLabel: "Oct 18",
    relativeLabel: "2d",
    unread: false,
    author: SUM_ACCOUNT,
    text: "Streak over. Summit's 11-game win streak is snapped by Harbor.",
    engagement: { replies: 70, reposts: 190, likes: 1500 },
    attachment: {
      type: "streak",
      team: SUM,
      event: "streak_snapped",
      length: 11,
      snappedBy: HAR,
      gameId: "g3",
    },
  }),
  post({
    id: "showcase-trade",
    kind: "trade",
    occurredOn: "2026-10-16",
    dateLabel: "Oct 16",
    relativeLabel: "4d",
    unread: true,
    author: REPORTER,
    text: "Breaking: Harbor and Copper Ridge agree to a deal. Luca Brandt heads to the Foxes and Niko Farrell goes to the Lights, with a second-round pick going to Harbor.",
    replies: [
      reply(
        "showcase-trade",
        0,
        playerAccount(BRANDT),
        "Excited for the next chapter.",
      ),
    ],
    engagement: { replies: 640, reposts: 4200, likes: 18200 },
    attachment: {
      type: "trade",
      teams: [HAR, CRG],
      movements: [
        { player: BRANDT, fromTeamId: "har", toTeamId: "crg" },
        { player: FARRELL, fromTeamId: "crg", toTeamId: "har" },
      ],
      otherPieces: ["2027 second-round pick to Harbor"],
    },
  }),
  post({
    id: "showcase-signing",
    kind: "signing",
    occurredOn: "2026-10-15",
    dateLabel: "Oct 15",
    relativeLabel: "5d",
    unread: false,
    author: LKS_FAN,
    text: "Welcome to Lakeshore, Ravi Okafor!",
    engagement: { replies: 6, reposts: 9, likes: 120 },
    attachment: {
      type: "signing",
      player: OKAFOR,
      team: LKS,
      headline: "Tides sign Ravi Okafor",
      summary: "Ravi Okafor signs a 2-year deal with the Lakeshore Tides.",
    },
  }),
  post({
    id: "showcase-injury-full",
    kind: "injury",
    occurredOn: "2026-10-19",
    dateLabel: "Oct 19",
    relativeLabel: "1d",
    unread: true,
    author: REPORTER,
    text: "Summit's Jonah Pryce is out with a knee sprain and is expected back in early November.",
    replies: [
      reply(
        "showcase-injury-full",
        0,
        SUM_FAN,
        "Fingers crossed for Jonah Pryce.",
      ),
    ],
    engagement: { replies: 260, reposts: 700, likes: 5400 },
    attachment: {
      type: "injury",
      player: PRYCE,
      team: SUM,
      severity: "severe",
      bodyPart: "knee",
      expectedReturn: { earliest: "2026-11-02", latest: "2026-11-09" },
    },
  }),
  post({
    id: "showcase-injury-sparse",
    kind: "injury",
    occurredOn: "2026-10-18",
    dateLabel: "Oct 18",
    relativeLabel: "2d",
    unread: false,
    author: ANALYST,
    text: "Wes Tamaki left the game early. More information is expected soon.",
    engagement: { replies: 11, reposts: 14, likes: 205 },
    attachment: {
      type: "injury",
      player: TAMAKI,
      team: SUM,
      severity: null,
      bodyPart: null,
      expectedReturn: null,
    },
  }),
  post({
    id: "showcase-league-card",
    kind: "league",
    occurredOn: "2026-10-17",
    dateLabel: "Oct 17",
    relativeLabel: "3d",
    unread: false,
    author: LEAGUE_ACCOUNT,
    text: "Schedule update from the league office.",
    engagement: { replies: 18, reposts: 55, likes: 480 },
    attachment: {
      type: "league",
      headline: "Schedule update",
      summary: "Two games have been moved to a later date.",
    },
  }),
  post({
    id: "showcase-league-text-only",
    kind: "league",
    occurredOn: "2026-10-16",
    dateLabel: "Oct 16",
    relativeLabel: "4d",
    unread: false,
    author: LEAGUE_ACCOUNT,
    text: "The trade deadline is one week away. All clubs must submit moves by then.",
    engagement: { replies: 22, reposts: 61, likes: 530 },
    attachment: {
      type: "league",
      headline: "Trade deadline",
      summary: "The trade deadline is one week away.",
    },
  }),
];
