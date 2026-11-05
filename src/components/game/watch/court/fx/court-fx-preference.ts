import { useSyncExternalStore } from "react";
import { prefersReducedMotion } from "@/components/ui/CountUp";

/** Below this floor width the effects are too small to be worth the GPU. */
export const MIN_FX_COURT_PX = 420;
/** Below this floor width a tilted court leaves players too little room. */
export const MIN_TILT_COURT_PX = 560;

/**
 * How far the canvas under the tokens runs past each sideline, so a player on
 * the line isn't cut off the way the floor itself is.
 */
export const FX_BLEED_PX = 36;
/** How far the canvas over the tokens runs past the floor on every side. */
export const FX_OVER_BLEED_PX = 48;

/** A viewer's on/off choice, on unless they turned it off. */
function storedToggle(key: string) {
  const listeners = new Set<() => void>();
  /** The choice for this page when storage is blocked. */
  let fallback = true;
  return {
    read(): boolean {
      try {
        const stored = window.localStorage.getItem(key);
        return stored === null ? fallback : stored === "on";
      } catch {
        return fallback;
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(next: boolean) {
      fallback = next;
      try {
        window.localStorage.setItem(key, next ? "on" : "off");
      } catch {
        // Blocked storage: the choice lasts for this page only.
      }
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

const FX_TOGGLE = storedToggle("ballsim.courtFx");
const TILT_TOGGLE = storedToggle("ballsim.courtTilt");

/** The viewer's Effects toggle. */
export function useCourtFxPreference(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    FX_TOGGLE.subscribe,
    FX_TOGGLE.read,
    () => true,
  );
  return [on, FX_TOGGLE.set];
}

/** The viewer's camera: the tilted broadcast view, or straight overhead. */
export function useCourtTiltPreference(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    TILT_TOGGLE.subscribe,
    TILT_TOGGLE.read,
    () => true,
  );
  return [on, TILT_TOGGLE.set];
}

/**
 * Whether this device and viewer should run the effects at all. Automated
 * browsers are excluded so screenshot baselines never depend on a GPU.
 */
export function courtFxAllowed(): boolean {
  if (typeof window === "undefined" || prefersReducedMotion()) {
    return false;
  }
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  if (nav.webdriver || nav.connection?.saveData) {
    return false;
  }
  const lowCores =
    nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2;
  const lowMemory = nav.deviceMemory !== undefined && nav.deviceMemory <= 2;
  return !lowCores && !lowMemory;
}
