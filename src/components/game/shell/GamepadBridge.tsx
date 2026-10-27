"use client";

import { useEffect, useRef } from "react";
import {
  OPEN_COMMAND_PALETTE,
  isIdleFocus,
} from "@/components/game/shell/hub-keys";
import {
  initialPadState,
  stepPad,
  type PadAction,
  type PadDirection,
  type PadSnapshot,
  type PadState,
} from "@/components/game/shell/gamepad-map";
import { useSimulationActivity } from "@/components/game/simulation-activity";
import { setInputMode } from "@/components/ui/focus/input-mode";

const DIRECTION_KEY: Record<PadDirection, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), [role="option"], [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

const NON_TEXT_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
]);

function isTextField(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLInputElement) {
    return !NON_TEXT_INPUT_TYPES.has(element.type);
  }
  return (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  );
}

function keyDown(target: EventTarget, key: string) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

/** With nothing focused, the first board item (else control) of the page or dialog. */
function focusFirst(): void {
  const root =
    document.querySelector<HTMLElement>('[aria-modal="true"]') ??
    document.querySelector<HTMLElement>("main");
  if (!root) return;
  const target =
    root.querySelector<HTMLElement>("[data-focus-item]") ??
    root.querySelector<HTMLElement>(FOCUSABLE);
  target?.focus();
}

function perform(action: PadAction): void {
  const active = document.activeElement;
  const modalOpen = document.querySelector('[aria-modal="true"]') !== null;
  const typing = isTextField(active);
  const target: EventTarget = active ?? document.body;

  switch (action) {
    case "up":
    case "down":
    case "left":
    case "right":
      // In a text field only up/down act (they move the palette selection);
      // left/right belong to the caret.
      if (typing && (action === "left" || action === "right")) return;
      if (!typing && isIdleFocus()) return focusFirst();
      keyDown(target, DIRECTION_KEY[action]);
      return;
    case "confirm":
      if (typing) {
        // Only the palette's combobox input has a meaningful Enter.
        if (active?.getAttribute("role") === "combobox") {
          keyDown(active, "Enter");
        }
        return;
      }
      // A synthetic Enter does not activate links, so click.
      if (isIdleFocus()) return focusFirst();
      (active as HTMLElement).click();
      return;
    case "back":
      keyDown(target, "Escape");
      return;
    case "prevHub":
    case "nextHub":
      // Hub keys are ignored in fields and dialogs by ShellKeys itself; skip
      // the dispatch when the pad's focus is in a field.
      if (typing) return;
      keyDown(document.body, action === "prevHub" ? "q" : "e");
      return;
    case "sim":
      if (typing || modalOpen) return;
      document
        .querySelector<HTMLElement>('a[aria-label="Sim to next game"]')
        ?.click();
      return;
    case "search":
      if (typing || modalOpen) return;
      window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE));
      return;
  }
}

function connectedPads(): Gamepad[] {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return [];
  return Array.from(navigator.getGamepads()).filter(
    (pad): pad is Gamepad => pad !== null && pad.connected,
  );
}

function snapshotOf(pad: Gamepad): PadSnapshot {
  return {
    mapping: pad.mapping,
    pressed: pad.buttons.map((button) => button.pressed),
    axes: Array.from(pad.axes),
  };
}

/**
 * Optional gamepad support. Maps a standard controller onto the keyboard
 * model: the pad's actions are replayed as the same key events and clicks the
 * keyboard uses, so every FocusGrid, table, dialog and shell key works
 * unchanged. Polls only while a pad is connected and the tab is visible.
 * Idle (no pad) it adds two window listeners and nothing else. Never acts
 * during a simulation. Renders nothing.
 */
export function GamepadBridge() {
  const { simulationPending } = useSimulationActivity();
  const pendingRef = useRef(simulationPending);
  useEffect(() => {
    pendingRef.current = simulationPending;
  }, [simulationPending]);

  useEffect(() => {
    const states = new Map<number, PadState>();
    let frame: number | null = null;

    function stop() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    }

    function poll(now: number) {
      frame = null;
      const pads = connectedPads();
      if (pads.length === 0 || document.hidden) {
        states.clear();
        return;
      }
      const seen = new Set<number>();
      for (const pad of pads) {
        seen.add(pad.index);
        const result = stepPad(
          states.get(pad.index) ?? initialPadState(),
          snapshotOf(pad),
          now,
        );
        states.set(pad.index, result.state);
        if (pendingRef.current) continue;
        for (const action of result.actions) perform(action);
        // After the replayed key events, which would otherwise mark keyboard.
        if (result.actions.length > 0) setInputMode("gamepad");
      }
      for (const index of states.keys()) {
        if (!seen.has(index)) states.delete(index);
      }
      frame = requestAnimationFrame(poll);
    }

    function start() {
      if (frame !== null || document.hidden || connectedPads().length === 0) {
        return;
      }
      frame = requestAnimationFrame(poll);
    }

    function onDisconnected() {
      if (connectedPads().length === 0) {
        stop();
        states.clear();
      }
    }
    function onVisibility() {
      if (document.hidden) {
        stop();
        states.clear();
      } else {
        start();
      }
    }

    window.addEventListener("gamepadconnected", start);
    window.addEventListener("gamepaddisconnected", onDisconnected);
    document.addEventListener("visibilitychange", onVisibility);
    // A pad that connected before this mounted (browsers only announce it
    // after the first press, but be safe).
    start();
    return () => {
      stop();
      window.removeEventListener("gamepadconnected", start);
      window.removeEventListener("gamepaddisconnected", onDisconnected);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
