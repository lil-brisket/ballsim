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
 * Library image for fixed traits: the nearest entry nobody active uses, else
 * the least-used of the nearest few (shared). Null only for an empty library.
 */
function pickLibraryEntry(
  traits: PortraitTraits,
  library: readonly PortraitLibraryEntry[],
  usage: ReadonlyMap<string, number>,
): LibraryPick | null {
  const unused = nearestPortraitEntry(traits, library, {
    exclude: (id) => (usage.get(id) ?? 0) > 0,
  });
  if (unused !== null) {
    return { id: unused.entry.id, shared: false };
  }
  const pool = rankPortraitLibrary(traits, library).slice(
    0,
    PORTRAIT_LIBRARY_FALLBACK_POOL,
  );
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
  const missing = candidates.filter((id) => {
    const entry = existing[id];
    return !isValidPortraitAssignment(entry) || needsLibraryImage(entry);
  });
  if (missing.length === 0 && state.world.playerPortraits !== undefined) {
    return { state, assigned: 0, resolved: 0, duplicates: 0 };
  }

  const cardinality = options.cardinality ?? PORTRAIT_TRAIT_CARDINALITY;
  const active = activePortraitIds(state);
  const occupied = new Set<string>();
  const usage = new Map<string, number>();
  const claim = (entry: PlayerPortraitAssignment): void => {
    occupied.add(portraitTraitSignature(entry.traits));
    if (entry.libraryId !== undefined && libraryIds.has(entry.libraryId)) {
      usage.set(entry.libraryId, (usage.get(entry.libraryId) ?? 0) + 1);
    }
  };
  for (const id of active) {
    const entry = existing[id];
    if (isValidPortraitAssignment(entry)) {
      claim(entry);
    }
  }

  const next: Record<string, PlayerPortraitAssignment> = { ...existing };
  let assigned = 0;
  let resolved = 0;
  let duplicates = 0;
  for (const playerId of missing) {
    const current = existing[playerId];
    let assignment: PlayerPortraitAssignment;

    if (isValidPortraitAssignment(current)) {
      // Same face, new image: traits and salt never change once assigned.
      const { libraryId: _stale, ...face } = current;
      void _stale;
      const pick = pickLibraryEntry(current.traits, library, usage);
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
        const nearest = nearestPortraitEntry(traits, library);
        if (nearest !== null && (usage.get(nearest.entry.id) ?? 0) > 0) {
          continue;
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
        const pick = pickLibraryEntry(traits, library, usage);
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
      claim(assignment);
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
