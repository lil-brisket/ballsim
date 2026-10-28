/**
 * Which moments this viewer has already been shown, per browser
 * (localStorage, keyed by save and moment key). Nothing is written to the
 * save: a new device or a cleared browser shows a moment again, which is
 * harmless. When storage is blocked the memory copy still stops a moment
 * from reopening during the visit.
 *
 * A moment that auto-opens is marked seen as it opens (so a reload mid-moment
 * does not replay it) and stays "showing" until it is closed.
 */

export type MomentStatus = "unseen" | "showing" | "seen";

const PREFIX = "ballsim:moment:";

const memorySeen = new Set<string>();
const showing = new Set<string>();
const listeners = new Set<() => void>();

/**
 * Moment key for one team and season, e.g. `progression:team_1:2027`. A
 * league-wide moment passes the viewer's team too, so every owner in a shared
 * league gets their own "seen".
 */
export function momentKey(
  kind: string,
  teamId: string,
  seasonYear: number,
): string {
  return `${kind}:${teamId}:${seasonYear}`;
}

function storageKey(saveId: string, key: string): string {
  return `${PREFIX}${saveId}:${key}`;
}

function readStored(id: string): boolean {
  try {
    return window.localStorage.getItem(id) !== null;
  } catch {
    return false;
  }
}

function writeStored(id: string): void {
  try {
    window.localStorage.setItem(id, "1");
  } catch {
    // Blocked storage: the memory copy covers this visit.
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function momentStatus(saveId: string, key: string): MomentStatus {
  if (typeof window === "undefined") return "seen";
  const id = storageKey(saveId, key);
  if (showing.has(id)) return "showing";
  return memorySeen.has(id) || readStored(id) ? "seen" : "unseen";
}

/** Auto-open: record the moment as seen and keep it showing until closed. */
export function beginMoment(saveId: string, key: string): void {
  const id = storageKey(saveId, key);
  memorySeen.add(id);
  showing.add(id);
  writeStored(id);
  emit();
}

/** Closed (or skipped): seen from now on. */
export function endMoment(saveId: string, key: string): void {
  const id = storageKey(saveId, key);
  memorySeen.add(id);
  showing.delete(id);
  writeStored(id);
  emit();
}

export function subscribeMoments(listener: () => void): () => void {
  listeners.add(listener);
  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key.startsWith(PREFIX)) listener();
  }
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Test helper: forget the memory copies (storage is cleared by the test). */
export function resetMomentsForTests(): void {
  memorySeen.clear();
  showing.clear();
  emit();
}
