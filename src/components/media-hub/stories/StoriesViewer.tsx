"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  acquireDrawerScrollLock,
  releaseDrawerScrollLock,
} from "@/components/ui/drawer-scroll-lock";
import { cn, focusRingClass, touchTargetClass } from "@/components/ui/styles";
import { DEFAULT_TEAM_THEME } from "@/presentation/team-theme";

export type StoryViewerRing = {
  key: string;
  label: string;
  latestOn: string;
  slideCount: number;
  slides: ReactNode[];
  accentColor?: string | null;
};

export const STORY_AUTO_ADVANCE_MS = 5000;

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/* ---------- seen state (localStorage via an external store) ---------- */

const seenListeners = new Set<() => void>();
// Writes that storage rejects still count for this page view.
const memorySeen = new Map<string, Record<string, string>>();
let seenVersion = 0;

function storageKey(saveId: string): string {
  return `ballsim:media-stories:${saveId}`;
}

function readRaw(saveId: string): string {
  try {
    return window.localStorage.getItem(storageKey(saveId)) ?? "";
  } catch {
    return "";
  }
}

function parseSeen(raw: string): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function currentSeen(saveId: string): Record<string, string> {
  return { ...parseSeen(readRaw(saveId)), ...memorySeen.get(saveId) };
}

function markSeen(saveId: string, ring: { key: string; latestOn: string }) {
  const current = currentSeen(saveId);
  if (current[ring.key] && current[ring.key]! >= ring.latestOn) return;
  current[ring.key] = ring.latestOn;
  memorySeen.set(saveId, current);
  seenVersion += 1;
  try {
    window.localStorage.setItem(storageKey(saveId), JSON.stringify(current));
    memorySeen.delete(saveId);
  } catch {
    // Storage unavailable; the in-memory copy still updates this page view.
  }
  for (const listener of seenListeners) listener();
}

/** Test helper: drop in-memory fallback state between cases. */
export function resetStoriesSeenForTests(): void {
  memorySeen.clear();
  seenVersion = 0;
}

function subscribeSeen(listener: () => void) {
  seenListeners.add(listener);
  return () => {
    seenListeners.delete(listener);
  };
}

function useSeenMap(saveId: string): Record<string, string> {
  // The server snapshot (also used for the first client render) is empty, so
  // every ring starts as new and hydration matches. The real value arrives
  // right after mount.
  const snapshot = useSyncExternalStore(
    subscribeSeen,
    () => `${seenVersion}:${readRaw(saveId)}`,
    () => "",
  );
  return useMemo(
    () => (snapshot === "" ? {} : currentSeen(saveId)),
    [snapshot, saveId],
  );
}

/* ---------- reduced motion ---------- */

function subscribeReducedMotion(listener: () => void) {
  try {
    const query = window.matchMedia?.(REDUCED_MOTION_QUERY);
    query?.addEventListener?.("change", listener);
    return () => query?.removeEventListener?.("change", listener);
  } catch {
    return () => undefined;
  }
}

function getReducedMotion(): boolean {
  try {
    return window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ?? false;
  } catch {
    return false;
  }
}

/* ---------- glyphs ---------- */

function StoryGlyph(props: { storyKey: string }) {
  const common = {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };
  switch (props.storyKey) {
    case "last-night":
      return (
        <svg {...common}>
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />
        </svg>
      );
    case "top-performers":
      return (
        <svg {...common}>
          <path d="m12 3 2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.4l6-.9L12 3Z" />
        </svg>
      );
    case "your-team":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3v18M5.6 5.6c3 2.4 3 10.4 0 12.8M18.4 5.6c-3 2.4-3 10.4 0 12.8" />
        </svg>
      );
    case "awards":
      return (
        <svg {...common}>
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 14v4M8 20h8" />
        </svg>
      );
    case "trade-wire":
      return (
        <svg {...common}>
          <path d="M4 8h15m0 0-3-3m3 3-3 3M20 16H5m0 0 3-3m-3 3 3 3" />
        </svg>
      );
    case "injury-report":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

/* ---------- viewer ---------- */

type Position = { ring: number; slide: number };

/**
 * The dialog portals to document.body, outside the element that sets the
 * user team's `--team-*` vars. Copy them from the opener's nearest ancestor
 * that carries them (inline style walk; works in browsers and jsdom).
 */
function inheritedTeamVars(opener: HTMLElement): CSSProperties | undefined {
  const source = opener.closest<HTMLElement>('[style*="--team-primary"]');
  if (!source) return undefined;
  const vars: Record<string, string> = {};
  for (const key of Object.keys(DEFAULT_TEAM_THEME)) {
    const value = source.style.getPropertyValue(key).trim();
    if (value) vars[key] = value;
  }
  return Object.keys(vars).length > 0 ? (vars as CSSProperties) : undefined;
}

const FILL_KEYFRAMES =
  "@keyframes ballsim-story-fill{from{width:0}to{width:100%}}";

function StoryDialog(props: {
  rings: StoryViewerRing[];
  position: Position;
  onPosition: (position: Position) => void;
  onClose: () => void;
  autoAdvance: boolean;
  themeStyle?: CSSProperties;
}) {
  const { rings, position, onPosition, onClose, autoAdvance } = props;
  const ring = rings[position.ring]!;
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const paused = hovered || focusInside;

  const isFirst = position.ring === 0 && position.slide === 0;

  const next = useCallback(() => {
    if (position.slide + 1 < ring.slides.length) {
      onPosition({ ring: position.ring, slide: position.slide + 1 });
    } else if (position.ring + 1 < rings.length) {
      onPosition({ ring: position.ring + 1, slide: 0 });
    } else {
      onClose();
    }
  }, [position, ring.slides.length, rings.length, onPosition, onClose]);

  const previous = useCallback(() => {
    if (position.slide > 0) {
      onPosition({ ring: position.ring, slide: position.slide - 1 });
    } else if (position.ring > 0) {
      const prev = rings[position.ring - 1]!;
      onPosition({ ring: position.ring - 1, slide: prev.slides.length - 1 });
    }
  }, [position, rings, onPosition]);

  // Keep the latest callbacks reachable from stable listeners.
  const nextRef = useRef(next);
  const previousRef = useRef(previous);
  const closeFnRef = useRef(onClose);
  useEffect(() => {
    nextRef.current = next;
    previousRef.current = previous;
    closeFnRef.current = onClose;
  });

  useEffect(() => {
    acquireDrawerScrollLock();
    closeRef.current?.focus();
    return () => releaseDrawerScrollLock();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFnRef.current();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nextRef.current();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        previousRef.current();
      } else if (event.key === "Tab" && panelRef.current) {
        const nodes = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        );
        if (nodes.length === 0) return;
        const first = nodes[0]!;
        const last = nodes[nodes.length - 1]!;
        const active = document.activeElement;
        if (!panelRef.current.contains(active)) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Time left on the current slide. Pausing keeps it, so the timer resumes
  // where the (paused) fill animation stopped instead of starting over.
  const remainingRef = useRef(STORY_AUTO_ADVANCE_MS);
  useEffect(() => {
    remainingRef.current = STORY_AUTO_ADVANCE_MS;
  }, [position.ring, position.slide]);

  useEffect(() => {
    if (!autoAdvance || paused) return;
    const startedAt = performance.now();
    const timer = window.setTimeout(
      () => nextRef.current(),
      remainingRef.current,
    );
    return () => {
      window.clearTimeout(timer);
      remainingRef.current = Math.max(
        0,
        remainingRef.current - (performance.now() - startedAt),
      );
    };
  }, [autoAdvance, paused, position.ring, position.slide]);

  const total = ring.slides.length;
  const stepButton = cn(
    touchTargetClass,
    "rounded-md border border-zinc-700 px-3 text-sm text-zinc-200 hover:border-zinc-500 disabled:opacity-40",
    focusRingClass,
  );
  const sideZone = "w-8 shrink-0 touch-manipulation focus:outline-none sm:w-10";

  return createPortal(
    <div
      style={props.themeStyle}
      className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-6"
    >
      <button
        type="button"
        aria-label="Close stories"
        tabIndex={-1}
        className="absolute inset-0 hidden bg-black/70 sm:block"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative z-10 flex h-[100dvh] w-full max-w-none flex-col border-zinc-700 bg-zinc-900 shadow-xl sm:h-auto sm:max-h-[min(90dvh,52rem)] sm:max-w-[640px] sm:rounded-xl sm:border"
      >
        <style>{FILL_KEYFRAMES}</style>
        <div className="shrink-0 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <ol className="flex gap-1" aria-hidden="true">
            {ring.slides.map((_, index) => {
              const done = index < position.slide;
              const active = index === position.slide;
              return (
                <li
                  key={index}
                  data-segment={done ? "done" : active ? "active" : "upcoming"}
                  className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-700"
                >
                  {done || (active && !autoAdvance) ? (
                    <div className="h-full w-full bg-team-ink" />
                  ) : active ? (
                    <div
                      key={`${position.ring}-${position.slide}`}
                      className="h-full bg-team-ink"
                      style={{
                        animation: `ballsim-story-fill ${STORY_AUTO_ADVANCE_MS}ms linear forwards`,
                        animationPlayState: paused ? "paused" : "running",
                      }}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
          <div className="flex items-center gap-3 py-2">
            <h2
              id={titleId}
              className="min-w-0 flex-1 truncate text-base font-semibold text-zinc-50"
            >
              {ring.label}
            </h2>
            <p
              className="text-sm tabular-nums text-zinc-400"
              aria-live="polite"
              data-testid="story-position"
            >
              {position.slide + 1} of {total}
            </p>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={cn(
                touchTargetClass,
                "rounded-md border border-zinc-700 px-2.5 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-100",
                focusRingClass,
              )}
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="story-tap-previous"
            className={sideZone}
            onClick={previous}
          />
          <div
            className="min-h-0 min-w-0 flex-1 overflow-y-auto py-2"
            data-testid="story-slide"
            onFocus={() => setFocusInside(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setFocusInside(false);
              }
            }}
          >
            {ring.slides[position.slide]}
          </div>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="story-tap-next"
            className={sideZone}
            onClick={next}
          />
        </div>

        <div className="safe-area-bottom flex shrink-0 items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3">
          <button
            type="button"
            onClick={previous}
            disabled={isFirst}
            className={stepButton}
          >
            Previous
          </button>
          <button type="button" onClick={next} className={stepButton}>
            Next
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function StoriesViewer(props: {
  saveId: string;
  rings: StoryViewerRing[];
}) {
  const { saveId } = props;
  const rings = useMemo(
    () =>
      props.rings.filter(
        (ring) => ring.slideCount > 0 && ring.slides.length > 0,
      ),
    [props.rings],
  );
  const seen = useSeenMap(saveId);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    () => false,
  );
  const [position, setPosition] = useState<Position | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [themeStyle, setThemeStyle] = useState<CSSProperties | undefined>();

  const currentRing = position ? rings[position.ring] : undefined;
  const currentKey = currentRing?.key;
  const currentLatest = currentRing?.latestOn;
  useEffect(() => {
    if (currentKey && currentLatest) {
      markSeen(saveId, { key: currentKey, latestOn: currentLatest });
    }
  }, [saveId, currentKey, currentLatest]);

  const close = useCallback(() => {
    setPosition(null);
    // Dialog unmounts with this update; restore focus to the opener after.
    const opener = openerRef.current;
    window.setTimeout(() => opener?.focus(), 0);
  }, []);

  if (rings.length === 0) return null;

  return (
    <>
      <nav aria-label="Stories">
        <ul className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
          {rings.map((ring, index) => {
            const storedDate = seen[ring.key];
            const isNew = !storedDate || ring.latestOn > storedDate;
            const posts = `${ring.slideCount} ${ring.slideCount === 1 ? "post" : "posts"}`;
            return (
              <li key={ring.key} className="shrink-0">
                <button
                  type="button"
                  aria-label={`${ring.label}, ${posts}, ${isNew ? "new" : "seen"}`}
                  data-story-state={isNew ? "new" : "seen"}
                  onClick={(event) => {
                    openerRef.current = event.currentTarget;
                    setThemeStyle(inheritedTeamVars(event.currentTarget));
                    setPosition({ ring: index, slide: 0 });
                  }}
                  className={cn(
                    "flex w-20 touch-manipulation flex-col items-center gap-1 rounded-md py-1 active:opacity-80",
                    focusRingClass,
                  )}
                >
                  <span
                    className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-full border-2 bg-zinc-900 text-zinc-100",
                      isNew ? "border-team-ink" : "border-zinc-600",
                    )}
                    style={
                      isNew && ring.accentColor
                        ? { borderColor: ring.accentColor }
                        : undefined
                    }
                  >
                    <StoryGlyph storyKey={ring.key} />
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "w-full truncate text-center text-sm",
                      isNew ? "text-zinc-100" : "text-zinc-400",
                    )}
                  >
                    {ring.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      {position && currentRing ? (
        <StoryDialog
          rings={rings}
          position={position}
          onPosition={setPosition}
          onClose={close}
          autoAdvance={!reducedMotion}
          themeStyle={themeStyle}
        />
      ) : null}
    </>
  );
}
