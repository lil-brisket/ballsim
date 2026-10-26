"use client";

import { useCallback, useSyncExternalStore } from "react";

export type SoundSettings = { enabled: boolean; volume: number };

export const SOUND_STORAGE_KEY = "ballsim:sound";

/** Sound is off until the viewer turns it on. */
export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: false,
  volume: 0.5,
};

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SOUND_SETTINGS.volume;
  return Math.min(1, Math.max(0, value));
}

/** Parse a stored value; anything unusable falls back to the defaults. */
export function parseSoundSettings(raw: string | null): SoundSettings {
  if (!raw) return DEFAULT_SOUND_SETTINGS;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) {
      return DEFAULT_SOUND_SETTINGS;
    }
    const record = data as Record<string, unknown>;
    return {
      enabled: record.enabled === true,
      volume:
        typeof record.volume === "number"
          ? clampVolume(record.volume)
          : DEFAULT_SOUND_SETTINGS.volume,
    };
  } catch {
    return DEFAULT_SOUND_SETTINGS;
  }
}

function readStored(): string | null {
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(settings: SoundSettings): void {
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked (private mode): the setting lasts for this page only.
  }
}

let cache: SoundSettings | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Current settings (reads storage once, then serves the cache). */
export function getSoundSettings(): SoundSettings {
  if (typeof window === "undefined") return DEFAULT_SOUND_SETTINGS;
  cache ??= parseSoundSettings(readStored());
  return cache;
}

export function updateSoundSettings(patch: Partial<SoundSettings>): void {
  const current = getSoundSettings();
  const next: SoundSettings = {
    enabled: patch.enabled ?? current.enabled,
    volume: clampVolume(patch.volume ?? current.volume),
  };
  cache = next;
  writeStored(next);
  emit();
}

/** Test helper: forget the cache so the next read hits storage again. */
export function resetSoundSettingsForTests(): void {
  cache = null;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  function onStorage(event: StorageEvent) {
    if (event.key !== null && event.key !== SOUND_STORAGE_KEY) return;
    cache = parseSoundSettings(readStored());
    listener();
  }
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getServerSnapshot(): SoundSettings {
  return DEFAULT_SOUND_SETTINGS;
}

export function useSoundSettings(): SoundSettings & {
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
} {
  const settings = useSyncExternalStore(
    subscribe,
    getSoundSettings,
    getServerSnapshot,
  );
  const setEnabled = useCallback(
    (enabled: boolean) => updateSoundSettings({ enabled }),
    [],
  );
  const setVolume = useCallback(
    (volume: number) => updateSoundSettings({ volume }),
    [],
  );
  return { ...settings, setEnabled, setVolume };
}
