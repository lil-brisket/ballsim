import {
  isValidPortraitAssignment,
  PORTRAIT_GENERATOR_VERSION,
  PORTRAIT_TRAIT_CARDINALITY,
  PORTRAIT_TRAIT_KEYS,
  portraitCapacity,
  portraitTraitSignature,
  type PlayerPortraitAssignment,
  type PortraitTraitCardinality,
  type PortraitTraits,
} from "@/domain/entities/player-portrait";
import type { PortraitLibraryEntry } from "@/domain/portrait-library";
import { portraitHash } from "@/presentation/portrait-hash";
import type { GameState } from "@/state/game-state";
import {
  nearestPortraitEntry,
  rankPortraitLibrary,
} from "@/systems/portraits/nearest-portrait";
import { PORTRAIT_LIBRARY } from "@/systems/portraits/portrait-library";

/**
 * Probes tried per player before accepting a duplicate face.
 * Exhaustion policy: after this many collisions the salt-0 traits are kept
 * and the assignment is flagged `duplicate: true` (never blocks the game).
 */
export const PORTRAIT_MAX_SALT_PROBES = 32;

/**
 * When every library entry near a face is already in use, the least-used of
 * this many nearest entries is shared (and the assignment flagged duplicate).
 */
export const PORTRAIT_LIBRARY_FALLBACK_POOL = 8;

const NO_IMAGES: ReadonlySet<string> = new Set();

function xorshift32(value: number): number {
  let x = value === 0 ? 0x9e3779b9 : value;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

/** Deterministic traits for (save, player, salt). Pure and fast. */
export function derivePortraitTraits(
  saveId: string,
  playerId: string,
  salt: number,
  cardinality: PortraitTraitCardinality = PORTRAIT_TRAIT_CARDINALITY,
): PortraitTraits {
  // FNV-1a presentation hash. Never domain/simulation RNG.
  let x = portraitHash(`${saveId}:${playerId}:${salt}`);
  const traits = {} as PortraitTraits;
  for (const key of PORTRAIT_TRAIT_KEYS) {
    x = xorshift32(x);
    traits[key] = x % cardinality[key];
  }
  return traits;
}

export type EnsurePlayerPortraitsOptions = {
  /** Restrict candidates; defaults to every player + every draft prospect. */
  playerIds?: readonly string[];
  /** Test hook for a smaller trait space (exhaustion). */
  cardinality?: PortraitTraitCardinality;
  /** Image library to resolve against; defaults to the shipped manifest. */
  library?: readonly PortraitLibraryEntry[];
};

export type EnsurePlayerPortraitsResult = {
  state: GameState;
  /** Players / prospects that had no valid assignment and got one. */
  assigned: number;
  /** Existing assignments that gained (or re-resolved) a library image. */
  resolved: number;
  /** Assignments, new or resolved, that share a face or image. */
  duplicates: number;
};

function portraitCandidateIds(state: GameState): string[] {
  const ids = new Set<string>(Object.keys(state.world.players));
  for (const draft of Object.values(state.world.drafts)) {
    for (const prospectId of Object.keys(draft.prospects)) {
      ids.add(prospectId);
    }
  }
  return [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Ids whose face should not be reused: non-retired players + open-draft prospects. */
function activePortraitIds(state: GameState): Set<string> {
  const active = new Set<string>();
  for (const player of Object.values(state.world.players)) {
    if (player.retired !== true) {
      active.add(player.id);
    }
  }
  for (const draft of Object.values(state.world.drafts)) {
    if (draft.status === "complete") continue;
    for (const prospectId of Object.keys(draft.prospects)) {
      active.add(prospectId);
    }
  }
  return active;
}

type LibraryPick = { id: string; shared: boolean };

/**
 * Library image for fixed traits. Images used by teammates (`forbidden`) are
 * never chosen unless the library has nothing else. Prefers the nearest image
 * nobody active uses; otherwise shares the least-used of the nearest few
 * (flagged `shared`). Null only for an empty library.
 */
function pickLibraryEntry(
  traits: PortraitTraits,
  library: readonly PortraitLibraryEntry[],
  usage: ReadonlyMap<string, number>,
  forbidden: ReadonlySet<string>,
): LibraryPick | null {
  const unused = nearestPortraitEntry(traits, library, {
    exclude: (id) => (usage.get(id) ?? 0) > 0 || forbidden.has(id),
  });
  if (unused !== null) {
    return { id: unused.entry.id, shared: false };
  }
  let pool = rankPortraitLibrary(traits, library, {
    exclude: (id) => forbidden.has(id),
  }).slice(0, PORTRAIT_LIBRARY_FALLBACK_POOL);
  if (pool.length === 0) {
    // Every image is on this team already (tiny library): unavoidable.
    pool = rankPortraitLibrary(traits, library).slice(
      0,
      PORTRAIT_LIBRARY_FALLBACK_POOL,
    );
  }
  let best = pool[0];
  if (best === undefined) return null;
  for (const candidate of pool) {
    if (
      (usage.get(candidate.entry.id) ?? 0) < (usage.get(best.entry.id) ?? 0)
    ) {
      best = candidate;
    }
  }
  return { id: best.entry.id, shared: true };
}

type TeamKey = string;

/** Active player id → franchise, for players that have one (prospects don't). */
function teamOfPlayer(state: GameState, id: string): TeamKey | null {
  return state.world.players[id]?.teamId ?? null;
}

/**
 * Players who must give up their image because a teammate holds the same one.
 * The keeper is the player whose image is not flagged shared (then lowest id),
 * so a newcomer that was handed a reused image is the one that changes.
 */
function findSameTeamImageConflicts(
  state: GameState,
  existing: Readonly<Record<string, PlayerPortraitAssignment>>,
  active: ReadonlySet<string>,
  libraryIds: ReadonlySet<string>,
): Set<string> {
  const groups = new Map<string, string[]>();
  for (const id of active) {
    const team = teamOfPlayer(state, id);
    const entry = existing[id];
    if (
      team === null ||
      !isValidPortraitAssignment(entry) ||
      entry.libraryId === undefined ||
      !libraryIds.has(entry.libraryId)
    ) {
      continue;
    }
    const key = `${team}|${entry.libraryId}`;
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }
  const losers = new Set<string>();
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => {
      const flagA = existing[a]!.duplicate === true ? 1 : 0;
      const flagB = existing[b]!.duplicate === true ? 1 : 0;
      if (flagA !== flagB) return flagA - flagB;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    for (const id of members.slice(1)) losers.add(id);
  }
  return losers;
}

/**
 * Assigns a persisted portrait to every player / prospect missing a valid one,
 * and a library image to every assignment that lacks one (or whose image left
 * the manifest). Idempotent: valid assignments are never overwritten, an
 * existing face keeps its traits, and when nothing is missing the input state
 * reference is returned unchanged. Pure; no RNG, no I/O.
 */
export function ensurePlayerPortraits(
  state: GameState,
  options: EnsurePlayerPortraitsOptions = {},
): EnsurePlayerPortraitsResult {
  const existing = state.world.playerPortraits ?? {};
  const library = options.library ?? PORTRAIT_LIBRARY;
  const libraryIds = new Set(library.map((entry) => entry.id));
  const candidates =
    options.playerIds !== undefined
      ? [...options.playerIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      : portraitCandidateIds(state);

  const needsLibraryImage = (entry: PlayerPortraitAssignment): boolean =>
    library.length > 0 &&
    (entry.libraryId === undefined || !libraryIds.has(entry.libraryId));
  const active = activePortraitIds(state);
  const teammateConflicts =
    library.length > 0
      ? findSameTeamImageConflicts(state, existing, active, libraryIds)
      : new Set<string>();
  const missing = candidates.filter((id) => {
    const entry = existing[id];
    return (
      !isValidPortraitAssignment(entry) ||
      needsLibraryImage(entry) ||
      teammateConflicts.has(id)
    );
  });
  if (missing.length === 0 && state.world.playerPortraits !== undefined) {
    return { state, assigned: 0, resolved: 0, duplicates: 0 };
  }

  const cardinality = options.cardinality ?? PORTRAIT_TRAIT_CARDINALITY;
  const occupied = new Set<string>();
  const usage = new Map<string, number>();
  const teamImages = new Map<TeamKey, Set<string>>();
  const claim = (id: string, entry: PlayerPortraitAssignment): void => {
    occupied.add(portraitTraitSignature(entry.traits));
    // Losers of a same-team clash are about to change image; don't count it.
    if (teammateConflicts.has(id)) return;
    if (entry.libraryId !== undefined && libraryIds.has(entry.libraryId)) {
      usage.set(entry.libraryId, (usage.get(entry.libraryId) ?? 0) + 1);
      const team = teamOfPlayer(state, id);
      if (team !== null) {
        const images = teamImages.get(team) ?? new Set<string>();
        images.add(entry.libraryId);
        teamImages.set(team, images);
      }
    }
  };
  for (const id of active) {
    const entry = existing[id];
    if (isValidPortraitAssignment(entry)) {
      claim(id, entry);
    }
  }
  const forbiddenFor = (id: string): ReadonlySet<string> => {
    const team = teamOfPlayer(state, id);
    return (team !== null ? teamImages.get(team) : undefined) ?? NO_IMAGES;
  };

  const next: Record<string, PlayerPortraitAssignment> = { ...existing };
  let assigned = 0;
  let resolved = 0;
  let duplicates = 0;
  for (const playerId of missing) {
    const current = existing[playerId];
    let assignment: PlayerPortraitAssignment;

    if (isValidPortraitAssignment(current)) {
      // Same face, new image: traits and salt never change once assigned.
      const { libraryId: _stale, duplicate: _wasShared, ...face } = current;
      void _stale;
      void _wasShared;
      const pick = pickLibraryEntry(
        current.traits,
        library,
        usage,
        forbiddenFor(playerId),
      );
      assignment = {
        ...face,
        ...(pick === null ? {} : { libraryId: pick.id }),
        ...(pick?.shared === true ? { duplicate: true as const } : {}),
      };
      resolved += 1;
      if (assignment.duplicate === true) duplicates += 1;
    } else {
      assigned += 1;
      let fresh: PlayerPortraitAssignment | null = null;
      for (let salt = 0; salt < PORTRAIT_MAX_SALT_PROBES; salt += 1) {
        const traits = derivePortraitTraits(
          state.meta.saveId,
          playerId,
          salt,
          cardinality,
        );
        if (occupied.has(portraitTraitSignature(traits))) continue;
        const forbidden = forbiddenFor(playerId);
        const nearest = nearestPortraitEntry(traits, library, {
          exclude: (id) => forbidden.has(id),
        });
        if (library.length > 0) {
          // No image left for this team, or the nearest one is taken: re-probe.
          if (nearest === null || (usage.get(nearest.entry.id) ?? 0) > 0) {
            continue;
          }
        }
        fresh = {
          version: PORTRAIT_GENERATOR_VERSION,
          traits,
          salt,
          ...(nearest === null ? {} : { libraryId: nearest.entry.id }),
        };
        break;
      }
      if (fresh === null) {
        duplicates += 1;
        const traits = derivePortraitTraits(
          state.meta.saveId,
          playerId,
          0,
          cardinality,
        );
        const pick = pickLibraryEntry(
          traits,
          library,
          usage,
          forbiddenFor(playerId),
        );
        fresh = {
          version: PORTRAIT_GENERATOR_VERSION,
          traits,
          salt: 0,
          ...(pick === null ? {} : { libraryId: pick.id }),
          duplicate: true,
        };
      }
      assignment = fresh;
    }

    if (active.has(playerId)) {
      teammateConflicts.delete(playerId);
      claim(playerId, assignment);
    }
    next[playerId] = assignment;
  }

  return {
    state: {
      ...state,
      world: { ...state.world, playerPortraits: next },
    },
    assigned,
    resolved,
    duplicates,
  };
}

export type PortraitCapacityReport = {
  capacity: number;
  activeAssigned: number;
  activeMissing: number;
  duplicates: number;
  /** activeAssigned / capacity; "running low" is meaningful above ~0.01. */
  utilization: number;
};

export function getPortraitCapacityReport(
  state: GameState,
  cardinality: PortraitTraitCardinality = PORTRAIT_TRAIT_CARDINALITY,
): PortraitCapacityReport {
  const portraits = state.world.playerPortraits ?? {};
  let activeAssigned = 0;
  let activeMissing = 0;
  let duplicates = 0;
  for (const id of activePortraitIds(state)) {
    const entry = portraits[id];
    if (isValidPortraitAssignment(entry)) {
      activeAssigned += 1;
      if (entry.duplicate === true) duplicates += 1;
    } else {
      activeMissing += 1;
    }
  }
  const capacity = portraitCapacity(cardinality);
  return {
    capacity,
    activeAssigned,
    activeMissing,
    duplicates,
    utilization: activeAssigned / capacity,
  };
}

export type PortraitUsageReport = {
  libraryEntries: number;
  /** Active players and open-draft prospects. */
  activeSubjects: number;
  /** Active subjects without a library image. */
  unlinked: number;
  imagesInUse: number;
  /** Images worn by more than one active subject. */
  sharedImages: number;
  /** Active subjects wearing a shared image. */
  sharedSubjects: number;
  /** Uses of the busiest image. */
  maxUses: number;
  /** uses → number of images used that many times. */
  histogram: Record<number, number>;
  mostUsed: Array<{ id: string; uses: number }>;
  /** Teammates wearing the same image (the assignment rules never allow this). */
  sameTeamConflicts: Array<{
    teamId: string;
    libraryId: string;
    playerIds: string[];
  }>;
};

/** How often each library image is worn in this save, and any same-team clashes. */
export function getPortraitUsageReport(
  state: GameState,
  library: readonly PortraitLibraryEntry[] = PORTRAIT_LIBRARY,
): PortraitUsageReport {
  const portraits = state.world.playerPortraits ?? {};
  const libraryIds = new Set(library.map((entry) => entry.id));
  const usage = new Map<string, string[]>();
  const teamGroups = new Map<string, string[]>();
  let unlinked = 0;
  const active = activePortraitIds(state);
  for (const id of [...active].sort()) {
    const entry = portraits[id];
    if (
      !isValidPortraitAssignment(entry) ||
      entry.libraryId === undefined ||
      !libraryIds.has(entry.libraryId)
    ) {
      unlinked += 1;
      continue;
    }
    usage.set(entry.libraryId, [...(usage.get(entry.libraryId) ?? []), id]);
    const team = teamOfPlayer(state, id);
    if (team !== null) {
      const key = `${team}|${entry.libraryId}`;
      teamGroups.set(key, [...(teamGroups.get(key) ?? []), id]);
    }
  }
  const histogram: Record<number, number> = {};
  let sharedImages = 0;
  let sharedSubjects = 0;
  let maxUses = 0;
  for (const users of usage.values()) {
    histogram[users.length] = (histogram[users.length] ?? 0) + 1;
    maxUses = Math.max(maxUses, users.length);
    if (users.length > 1) {
      sharedImages += 1;
      sharedSubjects += users.length;
    }
  }
  const mostUsed = [...usage.entries()]
    .map(([id, users]) => ({ id, uses: users.length }))
    .sort((a, b) => b.uses - a.uses || (a.id < b.id ? -1 : 1))
    .slice(0, 5);
  const sameTeamConflicts = [...teamGroups.entries()]
    .filter(([, players]) => players.length > 1)
    .map(([key, playerIds]) => {
      const [teamId, libraryId] = key.split("|") as [string, string];
      return { teamId, libraryId, playerIds };
    });
  return {
    libraryEntries: library.length,
    activeSubjects: active.size,
    unlinked,
    imagesInUse: usage.size,
    sharedImages,
    sharedSubjects,
    maxUses,
    histogram,
    mostUsed,
    sameTeamConflicts,
  };
}
