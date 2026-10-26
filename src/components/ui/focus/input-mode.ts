/**
 * Whether the viewer is driving the app with the keyboard right now. Set on
 * <html data-input="keyboard|pointer"> by ShellKeys; focus restoration only
 * happens in keyboard mode so pointer users are never surprised by a jump.
 */
export function isKeyboardMode(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.dataset.input === "keyboard"
  );
}

export function setInputMode(mode: "keyboard" | "pointer"): void {
  document.documentElement.dataset.input = mode;
}
