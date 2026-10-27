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
  /** The lead slide's face or logo, drawn inside the ring. */
  media: ReactNode;
  mediaKind: StoryRingMediaKind;
};

export type StoryRingMediaKind = "portrait" | "logo" | "trophy";

export const STORY_AUTO_ADVANCE_MS = 5000;

const FOCUSABLE =
  'a[href], button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  onClose: (restoreFocus?: boolean) => void;
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
  const chevron = cn(
    "hidden h-11 w-11 shrink-0 items-center justify-center rounded-full border border-disabled bg-black/40 text-lg text-ink hover:border-muted touch-manipulation active:opacity-80 disabled:opacity-30 sm:inline-flex",
    focusRingClass,
  );

  return createPortal(
    <div
      style={props.themeStyle}
      className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:items-center sm:p-6"
    >
      <button
        type="button"
        aria-label="Close stories"
        tabIndex={-1}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={() => onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative z-10 flex h-[100dvh] w-full items-center justify-center gap-4 sm:h-auto sm:w-auto"
      >
        <style>{FILL_KEYFRAMES}</style>
        <button
          type="button"
          onClick={previous}
          disabled={isFirst}
          aria-label="Previous story"
          className={chevron}
        >
          <span aria-hidden="true">‹</span>
        </button>

        <div className="relative h-full w-full overflow-hidden bg-surface-arena sm:aspect-[9/16] sm:h-[min(90dvh,46rem)] sm:w-auto sm:max-w-[420px] sm:rounded-2xl sm:border sm:border-line-strong">
          <h2 id={titleId} className="sr-only">
            {ring.label}
          </h2>
          <p
            className="sr-only"
            aria-live="polite"
            data-testid="story-position"
          >
            {position.slide + 1} of {total}
          </p>

          <div
            className="absolute inset-0"
            data-testid="story-slide"
            onFocus={() => setFocusInside(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setFocusInside(false);
              }
            }}
            onClick={(event) => {
              // "Open post" navigates within the page; get out of its way.
              if ((event.target as HTMLElement).closest("a")) onClose(false);
            }}
          >
            {ring.slides[position.slide]}
          </div>

          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="story-tap-previous"
            className="absolute bottom-28 left-0 top-16 z-10 w-1/3 touch-manipulation focus:outline-none"
            onClick={previous}
          />
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="story-tap-next"
            className="absolute bottom-28 right-0 top-16 z-10 w-1/3 touch-manipulation focus:outline-none"
            onClick={next}
          />

          <ol
            className="pointer-events-none absolute inset-x-0 top-0 z-30 flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
            aria-hidden="true"
          >
            {ring.slides.map((_, index) => {
              const done = index < position.slide;
              const active = index === position.slide;
              return (
                <li
                  key={index}
                  data-segment={done ? "done" : active ? "active" : "upcoming"}
                  className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"
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

          <button
            ref={closeRef}
            type="button"
            onClick={() => onClose()}
            aria-label="Close"
            className={cn(
              touchTargetClass,
              "absolute right-2 top-[max(1.5rem,calc(env(safe-area-inset-top)+0.75rem))] z-30 rounded-full bg-black/40 text-lg text-ink hover:bg-black/60",
              focusRingClass,
            )}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <button
          type="button"
          onClick={next}
          aria-label="Next story"
          className={chevron}
        >
          <span aria-hidden="true">›</span>
        </button>
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

  const close = useCallback((restoreFocus = true) => {
    setPosition(null);
    // Dialog unmounts with this update; restore focus to the opener after.
    // Skipped when following a link, which sets its own scroll and focus.
    if (!restoreFocus) return;
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
                    data-ring-state={isNew ? "new" : "seen"}
                    className={cn(
                      "flex h-[72px] w-[72px] items-center justify-center rounded-full p-[3px]",
                      isNew
                        ? "bg-[conic-gradient(from_200deg,var(--team-ink),var(--team-primary),var(--team-ink))]"
                        : "ring-1 ring-disabled",
                    )}
                  >
                    <span
                      data-ring-media={ring.mediaKind}
                      className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-surface-base bg-surface-raised"
                    >
                      {ring.media}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      "w-full truncate text-center text-sm",
                      isNew ? "text-ink" : "text-muted",
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
