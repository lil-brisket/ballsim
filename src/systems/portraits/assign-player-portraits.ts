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
import type { GameState } from "@/state/game-state";

/**
 * Probes tried per player before accepting a duplicate face.
 * Exhaustion policy: after this many collisions the salt-0 traits are kept
 * and the assignment is flagged `duplicate: true` (never blocks the game).
 */
export const PORTRAIT_MAX_SALT_PROBES = 32;

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a. Presentation identity only — never domain/simulation RNG. */
function fnv1a(input: string): number {
  let hash = FNV_OFFSET;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

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
  let x = fnv1a(`${saveId}:${playerId}:${salt}`);
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
};

export type EnsurePlayerPortraitsResult = {
  state: GameState;
  assigned: number;
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

/**
 * Assigns a persisted portrait to every player / prospect missing a valid one.
 * Idempotent: valid assignments are never overwritten, and when nothing is
 * missing the input state reference is returned unchanged.
 */
export function ensurePlayerPortraits(
  state: GameState,
  options: EnsurePlayerPortraitsOptions = {},
): EnsurePlayerPortraitsResult {
  const existing = state.world.playerPortraits ?? {};
  const candidates =
    options.playerIds !== undefined
      ? [...options.playerIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      : portraitCandidateIds(state);
  const missing = candidates.filter(
    (id) => !isValidPortraitAssignment(existing[id]),
  );
  if (missing.length === 0 && state.world.playerPortraits !== undefined) {
    return { state, assigned: 0, duplicates: 0 };
  }

  const cardinality = options.cardinality ?? PORTRAIT_TRAIT_CARDINALITY;
  const occupied = new Set<string>();
  for (const id of activePortraitIds(state)) {
    const entry = existing[id];
    if (isValidPortraitAssignment(entry)) {
      occupied.add(portraitTraitSignature(entry.traits));
    }
  }

  const next: Record<string, PlayerPortraitAssignment> = { ...existing };
  let duplicates = 0;
  for (const playerId of missing) {
    let assignment: PlayerPortraitAssignment | null = null;
    for (let salt = 0; salt < PORTRAIT_MAX_SALT_PROBES; salt += 1) {
      const traits = derivePortraitTraits(
        state.meta.saveId,
        playerId,
        salt,
        cardinality,
      );
      if (!occupied.has(portraitTraitSignature(traits))) {
        assignment = { version: PORTRAIT_GENERATOR_VERSION, traits, salt };
        break;
      }
    }
    if (assignment === null) {
      duplicates += 1;
      assignment = {
        version: PORTRAIT_GENERATOR_VERSION,
        traits: derivePortraitTraits(state.meta.saveId, playerId, 0, cardinality),
        salt: 0,
        duplicate: true,
      };
    }
    occupied.add(portraitTraitSignature(assignment.traits));
    next[playerId] = assignment;
  }

  return {
    state: {
      ...state,
      world: { ...state.world, playerPortraits: next },
    },
    assigned: missing.length,
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
