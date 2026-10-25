/**
 * Fictional social accounts for the league timeline: the league office, one
 * account and one fan account per team, a handful of reporters and a stats
 * analyst, plus player accounts created on demand. Names are hashed from the
 * name pools and the save id, so a save always has the same cast. Nothing here
 * is persisted.
 */

import { FIRST_NAMES } from "@/data/names/first-names";
import { LAST_NAMES } from "@/data/names/last-names";
import type { GameState } from "@/state/game-state";
import { hashParts, pick } from "./seed";
import type { TimelinePlayerRef } from "./types";

export type TimelineAccountKind =
  "league" | "team" | "reporter" | "analyst" | "fan" | "player";

export type TimelineAvatar =
  | { type: "league"; letters: string }
  | { type: "logo"; teamId: string }
  | { type: "portrait"; playerId: string }
  | { type: "monogram"; initials: string; teamId: string | null };

export type TimelineAccount = {
  key: string;
  kind: TimelineAccountKind;
  displayName: string;
  /** Starts with @; letters, digits and underscore only. */
  handle: string;
  verified: boolean;
  teamId: string | null;
  playerId: string | null;
  beat: string | null;
  avatar: TimelineAvatar;
};

export type LeagueCast = {
  league: TimelineAccount;
  insider: TimelineAccount;
  analyst: TimelineAccount;
  /** Accounts that exist up front (everything but player accounts). */
  accounts: readonly TimelineAccount[];
  team(teamId: string): TimelineAccount | null;
  fan(teamId: string): TimelineAccount | null;
  /** Regional reporter for the team's conference; the insider otherwise. */
  beatFor(teamId: string): TimelineAccount;
  player(ref: TimelinePlayerRef): TimelineAccount;
  byKey(key: string): TimelineAccount | null;
};

const castCache = new WeakMap<GameState, LeagueCast>();

function alnum(text: string): string {
  return text.replace(/[^A-Za-z0-9]/g, "");
}

function initialsOf(text: string): string {
  const words = text.split(/[\s-]+/).filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
  return letters || "?";
}

const FAN_NAME_VARIANTS: ReadonlyArray<(city: string, name: string) => string> =
  [
    (_city, name) => `${name} Nest`,
    (_city, name) => `${name} Faithful`,
    (city) => `${city} Hoops Talk`,
    (_city, name) => `Die-hard ${name}`,
    (_city, name) => `${name} Courtside`,
  ];

export function buildLeagueCast(state: GameState): LeagueCast {
  const cached = castCache.get(state);
  if (cached) return cached;
  const cast = createCast(state);
  castCache.set(state, cast);
  return cast;
}

function createCast(state: GameState): LeagueCast {
  const saveId = String(state.meta.saveId);
  const league = state.world.league;
  const usedHandles = new Set<string>();
  const usedNames = new Set<string>();
  const byKey = new Map<string, TimelineAccount>();
  const accounts: TimelineAccount[] = [];

  const playerNames = new Set<string>();
  const playerNameCounts = new Map<string, number>();
  // Archived retired players count too, so handles do not change when a
  // retired player's row leaves the save.
  const people = [
    ...Object.values(state.world.players),
    ...Object.values(state.world.retiredPlayers).filter(
      (record) => state.world.players[record.id] === undefined,
    ),
  ];
  for (const player of people) {
    const full = `${player.firstName} ${player.lastName}`.toLowerCase();
    playerNames.add(full);
    playerNameCounts.set(full, (playerNameCounts.get(full) ?? 0) + 1);
  }

  function claimHandle(base: string, startAt = 2): string {
    const clean = alnum(base) || "Account";
    let candidate = clean;
    let suffix = startAt;
    while (usedHandles.has(candidate.toLowerCase())) {
      candidate = `${clean}${suffix}`;
      suffix += 1;
    }
    usedHandles.add(candidate.toLowerCase());
    return `@${candidate}`;
  }

  function register(account: TimelineAccount): TimelineAccount {
    byKey.set(account.key, account);
    accounts.push(account);
    return account;
  }

  function nameFor(role: string): { first: string; last: string } {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      const first = pick(
        FIRST_NAMES,
        hashParts(saveId, "cast", role, "f", attempt),
      );
      const last = pick(
        LAST_NAMES,
        hashParts(saveId, "cast", role, "l", attempt),
      );
      const full = `${first} ${last}`.toLowerCase();
      if (playerNames.has(full) || usedNames.has(full)) continue;
      usedNames.add(full);
      return { first, last };
    }
    // Pools are far larger than any roster, so this is unreachable in practice.
    const first = pick(FIRST_NAMES, hashParts(saveId, "cast", role, "f"));
    const last = pick(LAST_NAMES, hashParts(saveId, "cast", role, "l"));
    return { first, last };
  }

  function person(
    key: string,
    kind: "reporter" | "analyst",
    beat: string,
  ): TimelineAccount {
    const { first, last } = nameFor(key);
    return register({
      key,
      kind,
      displayName: `${first} ${last}`,
      handle: claimHandle(`${first}${last}`),
      verified: true,
      teamId: null,
      playerId: null,
      beat,
      avatar: {
        type: "monogram",
        initials: `${first.charAt(0)}${last.charAt(0)}`.toUpperCase(),
        teamId: null,
      },
    });
  }

  const leagueAccount = register({
    key: "league",
    kind: "league",
    displayName: league.name,
    handle: claimHandle(`${league.abbreviation}Office`),
    verified: true,
    teamId: null,
    playerId: null,
    beat: null,
    avatar: { type: "league", letters: league.abbreviation },
  });

  const teamAccounts = new Map<string, TimelineAccount>();
  const fanAccounts = new Map<string, TimelineAccount>();
  const teamIds = Object.keys(state.world.teams).sort();
  for (const teamId of teamIds) {
    const team = state.world.teams[teamId]!;
    teamAccounts.set(
      teamId,
      register({
        key: `team:${teamId}`,
        kind: "team",
        displayName: `${team.city} ${team.name}`,
        handle: claimHandle(`${team.abbreviation}${team.name}`),
        verified: true,
        teamId,
        playerId: null,
        beat: null,
        avatar: { type: "logo", teamId },
      }),
    );
  }

  const insider = person("insider", "reporter", "League insider");
  const analyst = person("analyst", "analyst", "Stats");

  const conferenceIds = Object.keys(state.world.conferences).sort().slice(0, 2);
  const beatByConference = new Map<string, TimelineAccount>();
  for (const conferenceId of conferenceIds) {
    const conference = state.world.conferences[conferenceId]!;
    beatByConference.set(
      conferenceId,
      person(`beat:${conferenceId}`, "reporter", conference.name),
    );
  }

  for (const teamId of teamIds) {
    const team = state.world.teams[teamId]!;
    const variant = pick(
      FAN_NAME_VARIANTS,
      hashParts(saveId, "cast", "fan", teamId),
    );
    const displayName = variant(team.city, team.name);
    fanAccounts.set(
      teamId,
      register({
        key: `fan:${teamId}`,
        kind: "fan",
        displayName,
        handle: claimHandle(displayName),
        verified: false,
        teamId,
        playerId: null,
        beat: null,
        avatar: { type: "monogram", initials: initialsOf(displayName), teamId },
      }),
    );
  }

  const playerAccounts = new Map<string, TimelineAccount>();

  // Independent of composition order: players never claim from the shared
  // handle set (reporter names already avoid player names). Players who share
  // a name get a suffix from their id.
  function playerHandle(ref: TimelinePlayerRef): string {
    const base = alnum(`${ref.firstName}${ref.lastName}`) || "Player";
    const full = `${ref.firstName} ${ref.lastName}`.toLowerCase();
    const shared =
      (playerNameCounts.get(full) ?? 0) > 1 ||
      usedHandles.has(base.toLowerCase());
    return shared
      ? `@${base}${2 + (hashParts(saveId, "handle", ref.playerId) % 97)}`
      : `@${base}`;
  }

  return {
    league: leagueAccount,
    insider,
    analyst,
    accounts,
    team: (teamId) => teamAccounts.get(teamId) ?? null,
    fan: (teamId) => fanAccounts.get(teamId) ?? null,
    beatFor(teamId) {
      const conferenceId = state.world.teams[teamId]?.conferenceId;
      return (conferenceId && beatByConference.get(conferenceId)) || insider;
    },
    player(ref) {
      const existing = playerAccounts.get(ref.playerId);
      if (existing) return existing;
      const account: TimelineAccount = {
        key: `player:${ref.playerId}`,
        kind: "player",
        displayName: `${ref.firstName} ${ref.lastName}`.trim(),
        handle: playerHandle(ref),
        verified: true,
        teamId: ref.teamId,
        playerId: ref.playerId,
        beat: null,
        avatar: { type: "portrait", playerId: ref.playerId },
      };
      playerAccounts.set(ref.playerId, account);
      byKey.set(account.key, account);
      return account;
    },
    byKey: (key) => byKey.get(key) ?? null,
  };
}
