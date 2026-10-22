/**
 * Short replies under notable posts. Authors are fans of the teams involved,
 * the beat reporter, the stats analyst and the player in the story. Text is
 * filled only from the post's attachment.
 */

import type { GameState } from "@/state/game-state";
import type { LeagueCast, TimelineAccount } from "./accounts";
import {
  cleanBodyPart,
  formatSeasonLabel,
  fullName,
  gameSides,
  joinParts,
  sentenceCase,
  the,
} from "./compose-text";
import { hashParts, pick } from "./seed";
import type { TimelinePlayerRef, TimelinePost, TimelineTeamRef } from "./types";

export type ComposedReply = {
  /** `${post.id}:reply:${index}` */
  id: string;
  author: TimelineAccount;
  text: string;
};

type Stance = "up" | "down" | "neutral";
type FanSpec = {
  team: TimelineTeamRef;
  stance: Stance;
  detail: string | null;
};
type Spec = {
  fans: FanSpec[];
  /** Team whose beat reporter chimes in; null uses the insider. */
  beatTeamId: string | null;
  reporter: string[];
  analyst: string[];
  players: Array<{ ref: TimelinePlayerRef; texts: string[] }>;
};

function fanTexts(spec: FanSpec): string[] {
  const { name } = spec.team;
  const d = spec.detail;
  if (spec.stance === "up") {
    return [
      joinParts(`Let's go ${name}!`, d),
      joinParts(`Love this ${name} team.`, d),
      joinParts(`${name} fans, enjoy this one.`, d),
    ];
  }
  if (spec.stance === "down") {
    return [
      joinParts("Tough one to swallow.", d),
      joinParts(`Back to work, ${name}.`, d),
      joinParts("We will bounce back from this.", d),
    ];
  }
  return [
    joinParts(`Curious to see what this means for the ${name}.`, d),
    joinParts(`Following this one closely as a ${name} fan.`, d),
  ];
}

function buildSpec(post: TimelinePost): Spec {
  const a = post.attachment;
  switch (a.type) {
    case "game": {
      const { winner, loser, winnerScore: ws, loserScore: ls } = gameSides(a);
      const winnerIsHome = a.winnerTeamId === a.home.teamId;
      const winPerf = winnerIsHome
        ? a.topPerformers.home
        : a.topPerformers.away;
      const losePerf = winnerIsHome
        ? a.topPerformers.away
        : a.topPerformers.home;
      return {
        fans: [
          { team: winner, stance: "up", detail: `${ws}–${ls}.` },
          { team: loser, stance: "down", detail: `${ws}–${ls}.` },
        ],
        beatTeamId: winner.teamId,
        reporter: [
          `${the(winner)} ${ws}, ${the(loser)} ${ls}. Worth watching how both teams respond.`,
          `The ${winner.name} take this one by ${a.margin}.`,
        ],
        analyst: [
          `A ${a.margin}-point margin says plenty about how this one went.`,
          `${ws} points was enough for the ${winner.name} here.`,
        ],
        players: [
          ...(winPerf
            ? [
                {
                  ref: winPerf.player,
                  texts: [
                    `Great team win, ${ws}–${ls}. Proud of this group.`,
                    "Everybody contributed tonight. Thank you for the support.",
                  ],
                },
              ]
            : []),
          ...(losePerf
            ? [
                {
                  ref: losePerf.player,
                  texts: [
                    "Not our night. We will be better.",
                    `${ws}–${ls} is not good enough. Back to work.`,
                  ],
                },
              ]
            : []),
        ],
      };
    }
    case "performance": {
      const name = fullName(a.player);
      return {
        fans: [
          {
            team: a.team,
            stance: a.won ? "up" : "down",
            detail: `${a.line.points} points for ${name}.`,
          },
          { team: a.opponent, stance: a.won ? "down" : "up", detail: null },
        ],
        beatTeamId: a.team.teamId,
        // The card shows the stat line; replies react to it.
        reporter: [
          `${name} set the tone for the ${a.team.name} tonight.`,
          `The ${a.team.name} leaned on ${name} all night.`,
        ],
        analyst: [
          `${a.line.points} points is the number that stands out.`,
          `Hard to slow down ${name} on a night like this.`,
        ],
        players: [
          {
            ref: a.player,
            texts: a.won
              ? [
                  "Team win matters most. Thank you all.",
                  "Credit to my teammates tonight.",
                ]
              : [
                  "Not enough tonight. Back to work.",
                  "We will be better next time out.",
                ],
          },
        ],
      };
    }
    case "award": {
      const name = a.winner ? fullName(a.winner) : a.winnerCoachName;
      return {
        fans: a.team
          ? [
              {
                team: a.team,
                stance: "up",
                detail: name ? `Well deserved, ${name}.` : null,
              },
            ]
          : [],
        beatTeamId: a.team?.teamId ?? null,
        reporter: [
          `The ${a.awardName} for ${formatSeasonLabel(a.seasonYear)} is official.`,
        ],
        // The award card already shows the numbers.
        analyst: [
          `The ${a.awardName} is a deserving honor.`,
          `The ${a.awardName} race was worth following.`,
        ],
        players: a.winner
          ? [
              {
                ref: a.winner,
                texts: [
                  "Honored. Thank you to my teammates and coaches.",
                  "Grateful for everyone who helped me get here.",
                ],
              },
            ]
          : [],
      };
    }
    case "playoff": {
      const s = a.seriesScore;
      const detail = s ? `${s.winner}–${s.loser}.` : null;
      return {
        fans: [
          { team: a.winner, stance: "up", detail },
          ...(a.loser
            ? [{ team: a.loser, stance: "down" as const, detail }]
            : []),
        ],
        beatTeamId: a.winner.teamId,
        reporter: [
          a.event === "champion"
            ? `The ${a.winner.displayName} are the ${formatSeasonLabel(a.seasonYear)} champions.`
            : `The ${a.winner.name} are the story of the ${formatSeasonLabel(a.seasonYear)} playoffs.`,
        ],
        analyst: [
          s
            ? `A ${s.winner}–${s.loser} series tells you plenty about this matchup.`
            : `${formatSeasonLabel(a.seasonYear)} will be remembered for the ${a.winner.name}.`,
        ],
        players: [],
      };
    }
    case "streak": {
      const win = a.event === "win_streak";
      return {
        fans: [
          {
            team: a.team,
            stance: win ? "up" : "down",
            detail: `${a.length} games.`,
          },
          ...(a.snappedBy
            ? [{ team: a.snappedBy, stance: "up" as const, detail: null }]
            : []),
        ],
        beatTeamId: a.team.teamId,
        reporter: [
          win
            ? `The ${a.team.name} have won ${a.length} in a row.`
            : `The ${a.team.name} are looking for answers after ${a.length} games.`,
        ],
        analyst: [
          win
            ? `${a.length} games is a long run in any league.`
            : `${a.length} games is a heavy stretch for any team.`,
        ],
        players: [],
      };
    }
    case "trade": {
      const mv = a.movements[0] ?? null;
      const to = mv ? a.teams.find((t) => t.teamId === mv.toTeamId) : null;
      return {
        fans: a.teams
          .slice(0, 2)
          .map((team) => ({ team, stance: "neutral" as const, detail: null })),
        beatTeamId: to?.teamId ?? a.teams[0]?.teamId ?? null,
        reporter: [
          mv && to
            ? `${fullName(mv.player)} is expected to join the ${to.name}.`
            : "More details on this trade should follow.",
        ],
        analyst: [
          a.movements.length > 0
            ? `${a.movements.length} ${a.movements.length === 1 ? "player" : "players"} moving in this deal.`
            : "A trade like this is worth a closer look.",
        ],
        players: mv
          ? [
              {
                ref: mv.player,
                texts: [
                  "Excited for the next chapter.",
                  "Thank you to everyone for the support.",
                ],
              },
            ]
          : [],
      };
    }
    case "signing":
      return {
        fans: a.team
          ? [
              {
                team: a.team,
                stance: "up",
                detail: a.player ? `Welcome, ${fullName(a.player)}.` : null,
              },
            ]
          : [],
        beatTeamId: a.team?.teamId ?? null,
        reporter: [
          a.team
            ? `The ${a.team.name} have added to their roster.`
            : "A new signing is on the books.",
        ],
        analyst: ["Depth moves like this often matter more than they look."],
        players: a.player
          ? [{ ref: a.player, texts: ["Glad to be here. Ready to work."] }]
          : [],
      };
    case "injury":
      return {
        fans: a.team
          ? [
              {
                team: a.team,
                stance: "down",
                detail: a.player
                  ? `Fingers crossed for ${fullName(a.player)}.`
                  : null,
              },
            ]
          : [],
        beatTeamId: a.team?.teamId ?? null,
        reporter: [
          cleanBodyPart(a.bodyPart)
            ? `The ${cleanBodyPart(a.bodyPart)} injury is being evaluated.`
            : "More information is expected soon.",
        ],
        analyst: ["Injuries like this can reshape a rotation quickly."],
        players: a.player
          ? [
              {
                ref: a.player,
                texts: [
                  "Thank you all for the support. Working on getting back.",
                ],
              },
            ]
          : [],
      };
    case "league":
      return {
        fans: [],
        beatTeamId: null,
        reporter: ["Worth watching how this develops."],
        analyst: ["A development worth tracking over the coming weeks."],
        players: [],
      };
  }
}

function replyCount(post: TimelinePost, hash: number): number {
  if (post.notability < 60) return 0;
  if (post.notability >= 85) return 3;
  if (post.notability >= 72) return 2 + (hash % 2);
  return 1 + (hash % 2);
}

export function composeReplies(
  state: GameState,
  cast: LeagueCast,
  post: TimelinePost,
  authorKey: string,
): ComposedReply[] {
  const saveId = String(state.meta.saveId);
  const count = replyCount(post, hashParts(saveId, post.id, "reply-count"));
  if (count === 0) return [];

  const spec = buildSpec(post);
  const fanTeamIds =
    post.attachment.type === "league" ? post.teamIds.slice(0, 2) : [];
  const pool: Array<{ account: TimelineAccount; texts: string[] }> = [];

  for (const fan of spec.fans) {
    const account = cast.fan(fan.team.teamId);
    if (account) pool.push({ account, texts: fanTexts(fan) });
  }
  for (const teamId of fanTeamIds) {
    const account = cast.fan(teamId);
    const team = state.world.teams[teamId];
    if (account && team) {
      pool.push({
        account,
        texts: fanTexts({
          team: {
            teamId,
            abbreviation: team.abbreviation,
            displayName: `${team.city} ${the(team)}`,
            name: team.name,
            branding: team.branding,
          },
          stance: "neutral",
          detail: null,
        }),
      });
    }
  }
  const reporter = spec.beatTeamId
    ? cast.beatFor(spec.beatTeamId)
    : cast.insider;
  pool.push({ account: reporter, texts: spec.reporter });
  pool.push({ account: cast.analyst, texts: spec.analyst });
  for (const player of spec.players) {
    pool.push({ account: cast.player(player.ref), texts: player.texts });
  }

  const seen = new Set<string>([authorKey]);
  const eligible = pool
    .filter(({ account, texts }) => {
      if (seen.has(account.key) || texts.length === 0) return false;
      seen.add(account.key);
      return true;
    })
    .map((entry) => ({
      entry,
      order: hashParts(saveId, post.id, "reply-order", entry.account.key),
    }))
    .sort(
      (x, y) =>
        x.order - y.order ||
        x.entry.account.key.localeCompare(y.entry.account.key),
    );

  return eligible.slice(0, count).map(({ entry }, index) => ({
    id: `${post.id}:reply:${index}`,
    author: entry.account,
    text: sentenceCase(
      pick(
        entry.texts,
        hashParts(saveId, post.id, "reply-text", entry.account.key),
      ),
    ),
  }));
}
