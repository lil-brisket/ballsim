/**
 * Pure gamepad -> app action mapping. The bridge feeds it one snapshot per
 * animation frame and gets back the actions to perform this frame.
 *
 * Only pads reporting the "standard" mapping are understood: that mapping
 * fixes what each button index and axis means (d-pad on 12-15, bottom face
 * button on 0, ...). Pads with an empty or custom mapping put different things
 * on the same indices, so acting on them would press the wrong controls;
 * they are ignored.
 *
 * Standard mapping used:
 *   12 up, 13 down, 14 left, 15 right (d-pad)   -> up/down/left/right
 *   0 bottom face   -> confirm       1 right face -> back
 *   4 left shoulder -> prevHub       5 right shoulder -> nextHub
 *   9 start/menu    -> sim           8 select/view -> search
 *   left stick (axes 0/1) past the dead zone -> up/down/left/right
 */

export type PadDirection = "up" | "down" | "left" | "right";
export type PadAction =
  PadDirection | "confirm" | "back" | "prevHub" | "nextHub" | "sim" | "search";

export type PadSnapshot = {
  mapping: string;
  pressed: readonly boolean[];
  axes: readonly number[];
};

export type PadHold = { pressedAt: number; firedAt: number };

export type PadState = {
  previous: PadSnapshot | null;
  holds: Partial<Record<PadDirection, PadHold>>;
};

export const STICK_DEAD_ZONE = 0.5;
/** Held directions repeat after this long... */
export const REPEAT_DELAY_MS = 400;
/** ...and then every this often. */
export const REPEAT_INTERVAL_MS = 120;

const DIRECTION_BUTTONS: ReadonlyArray<readonly [number, PadDirection]> = [
  [12, "up"],
  [13, "down"],
  [14, "left"],
  [15, "right"],
];

/** Fire once per press; not repeated. */
const ACTION_BUTTONS: ReadonlyArray<readonly [number, PadAction]> = [
  [0, "confirm"],
  [1, "back"],
  [4, "prevHub"],
  [5, "nextHub"],
  [9, "sim"],
  [8, "search"],
];

export function initialPadState(): PadState {
  return { previous: null, holds: {} };
}

function stickDirection(axes: readonly number[]): PadDirection | undefined {
  const x = axes[0] ?? 0;
  const y = axes[1] ?? 0;
  if (Math.max(Math.abs(x), Math.abs(y)) <= STICK_DEAD_ZONE) return undefined;
  // Diagonals resolve to the dominant axis so one push is one direction.
  if (Math.abs(y) >= Math.abs(x)) return y < 0 ? "up" : "down";
  return x < 0 ? "left" : "right";
}

function heldDirections(snapshot: PadSnapshot): Set<PadDirection> {
  const held = new Set<PadDirection>();
  for (const [index, direction] of DIRECTION_BUTTONS) {
    if (snapshot.pressed[index]) held.add(direction);
  }
  const stick = stickDirection(snapshot.axes);
  if (stick) held.add(stick);
  return held;
}

/**
 * Advance one frame. `now` is a millisecond timestamp (monotonic). Buttons are
 * edge-triggered against the previous snapshot (a button already down when the
 * first snapshot arrives does not fire); directions fire on press, then repeat
 * while held.
 */
export function stepPad(
  state: PadState,
  current: PadSnapshot,
  now: number,
): { state: PadState; actions: PadAction[] } {
  if (current.mapping !== "standard") {
    return { state: { previous: null, holds: {} }, actions: [] };
  }

  const actions: PadAction[] = [];
  const previous = state.previous ?? current;

  for (const [index, action] of ACTION_BUTTONS) {
    if (current.pressed[index] && !previous.pressed[index]) {
      actions.push(action);
    }
  }

  const held = heldDirections(current);
  const holds: PadState["holds"] = {};
  for (const direction of ["up", "down", "left", "right"] as const) {
    if (!held.has(direction)) continue;
    const hold = state.holds[direction];
    if (!hold) {
      holds[direction] = { pressedAt: now, firedAt: now };
      actions.push(direction);
    } else if (
      now - hold.pressedAt >= REPEAT_DELAY_MS &&
      now - hold.firedAt >= REPEAT_INTERVAL_MS
    ) {
      holds[direction] = { pressedAt: hold.pressedAt, firedAt: now };
      actions.push(direction);
    } else {
      holds[direction] = hold;
    }
  }

  return { state: { previous: current, holds }, actions };
}
