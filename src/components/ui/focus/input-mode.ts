import { useSyncExternalStore } from "react";

export type InputMode = "keyboard" | "pointer" | "gamepad";

const CHANGE_EVENT = "ballsim:input-mode";

/**
 * Whether the viewer is driving the app with the keyboard (or a gamepad,
 * which moves focus the same way) right now. Set on
 * <html data-input="keyboard|pointer|gamepad"> by ShellKeys and GamepadBridge;
 * focus restoration only happens in these modes so pointer users are never
 * surprised by a jump.
 */
export function isKeyboardMode(): boolean {
  const mode = getInputMode();
  return mode === "keyboard" || mode === "gamepad";
}

export function getInputMode(): InputMode | undefined {
  if (typeof document === "undefined") return undefined;
  const mode = document.documentElement.dataset.input;
  return mode === "keyboard" || mode === "pointer" || mode === "gamepad"
    ? mode
    : undefined;
}

export function setInputMode(mode: InputMode): void {
  if (document.documentElement.dataset.input === mode) return;
  document.documentElement.dataset.input = mode;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** Current input mode, re-rendering on change (undefined until first input). */
export function useInputMode(): InputMode | undefined {
  return useSyncExternalStore(subscribe, getInputMode, () => undefined);
}
