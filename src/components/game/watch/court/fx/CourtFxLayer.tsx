"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { PlayChoreography } from "@/state/watch-court-choreo";
import {
  courtFxAllowed,
  FX_BLEED_PX,
  FX_OVER_BLEED_PX,
  MIN_FX_COURT_PX,
} from "./court-fx-preference";
import type { CourtFxScene, CourtFxSceneInput } from "./fx-scene";

let sceneModule: Promise<typeof import("./fx-scene")> | null = null;

/** One load, however many layers mount while it is in flight. */
function loadSceneModule() {
  sceneModule ??= import("./fx-scene");
  return sceneModule;
}

/**
 * Decorative canvases on the court floor: the floor finish and shadows under
 * the tokens, and bursts, trail and particles over them (below the callouts).
 * They add light and nothing else: no pointer events, hidden from assistive
 * tech, and when Pixi cannot start the empty hosts leave the replay as it was.
 * Pixi loads with `fx-scene` on first use, so it stays out of the page's bundle.
 */
export function CourtFxLayer(
  props: CourtFxSceneInput & {
    width: number;
    height: number;
    /** Play time (0..1) of a play, while the court is running that play. */
    getClock: (play: PlayChoreography) => number | null;
    /** Whether a scene is drawing, so the court can rely on what it draws. */
    onReady?: (ready: boolean) => void;
  },
) {
  const { width, height, getClock, onReady, ...input } = props;
  const underRef = useRef<HTMLDivElement>(null);
  const overRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CourtFxScene | null>(null);
  const latest = useRef({ input, width, height, getClock, onReady });
  useLayoutEffect(() => {
    latest.current = { input, width, height, getClock, onReady };
  });

  const wideEnough = width >= MIN_FX_COURT_PX;

  useEffect(() => {
    const under = underRef.current;
    const over = overRef.current;
    if (!under || !over || !wideEnough || !courtFxAllowed()) {
      return;
    }
    // Strict Mode and quick unmounts: a scene that finishes loading after its
    // effect was cleaned up destroys itself instead of adding a second canvas.
    let cancelled = false;
    let scene: CourtFxScene | null = null;
    const { width: w, height: h } = latest.current;
    loadSceneModule()
      .then(({ CourtFxScene }) =>
        CourtFxScene.create({ under, over }, { width: w, height: h }, (play) =>
          latest.current.getClock(play),
        ),
      )
      .then((created) => {
        if (cancelled) {
          created?.destroy();
          return;
        }
        scene = created;
        sceneRef.current = created;
        created?.setSize(latest.current.width, latest.current.height);
        created?.sync(latest.current.input);
        latest.current.onReady?.(created !== null);
      })
      .catch(() => {
        // No WebGL or a failed load: the replay carries on without effects.
      });
    return () => {
      cancelled = true;
      sceneRef.current = null;
      scene?.destroy();
      latest.current.onReady?.(false);
    };
  }, [wideEnough]);

  useEffect(() => {
    sceneRef.current?.setSize(width, height);
  }, [width, height]);

  // Every render: the scene compares choreographies itself.
  useEffect(() => {
    sceneRef.current?.sync(latest.current.input);
  });

  return (
    <>
      <div
        ref={underRef}
        aria-hidden="true"
        data-testid="court-fx"
        className="pointer-events-none absolute inset-x-0 overflow-hidden"
        style={{ top: -FX_BLEED_PX, bottom: -FX_BLEED_PX }}
      />
      <div
        ref={overRef}
        aria-hidden="true"
        data-testid="court-fx-over"
        className="pointer-events-none absolute z-25 overflow-hidden"
        style={{ inset: -FX_OVER_BLEED_PX }}
      />
    </>
  );
}
