import type { ReactNode } from "react";
import {
  hashPlayerIdForPortrait,
  portraitCompositionIndex,
  portraitPlateIndex,
} from "@/presentation/portrait-hash";
import { cn } from "@/components/ui/styles";
import {
  PortraitFace,
  type PortraitUniform,
} from "@/components/basketball/PortraitFace";
import {
  isValidPortraitAssignment,
  type PlayerPortraitAssignment,
} from "@/domain/entities/player-portrait";

export type PortraitState =
  /** Persisted procedural face, no raster overlay. */
  "assigned" | "missing" | "pending" | "ready" | "failed" | "invalid";

export type PlayerPortraitSize = "xs" | "sm" | "ms" | "md" | "lg" | "xl";

export type PlayerPortraitProps = {
  playerId: string;
  firstName: string;
  lastName: string;
  size: PlayerPortraitSize;
  /** Persisted procedural portrait (world.playerPortraits). Invalid/null → initials plate. */
  portrait?: PlayerPortraitAssignment | null;
  /** Raster overlay state; defaults from `portrait` ("assigned" or "missing"). */
  state?: PortraitState;
  /** Only honored when state === "ready". */
  src?: string;
  /** Team colours for the jersey; omit for the neutral default. */
  uniform?: PortraitUniform | null;
  className?: string;
};

export const PORTRAIT_SIZE_PX: Record<PlayerPortraitSize, number> = {
  xs: 24,
  sm: 32,
  ms: 40,
  md: 64,
  lg: 96,
  xl: 144,
};

const SIZE_CLASS: Record<PlayerPortraitSize, string> = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  ms: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
  xl: "h-36 w-36",
};

const INITIALS_CLASS: Record<PlayerPortraitSize, string> = {
  xs: "text-[8px]",
  sm: "text-[10px]",
  ms: "text-xs",
  md: "text-lg",
  lg: "text-2xl",
  xl: "text-4xl",
};

const PLATE_FILLS = [
  "#27272a",
  "#3f3f46",
  "#18181b",
  "#1c1c1f",
  "#09090b",
  "#3f3f4688",
  "#1e293b",
  "#0f172a",
] as const;

const ACCENT = "#d97706";

function initialsOf(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase();
}

function FallbackMark(props: {
  plateIndex: number;
  compositionIndex: number;
}): ReactNode {
  const fill = PLATE_FILLS[props.plateIndex] ?? PLATE_FILLS[0];
  const accent = accentShape(props.compositionIndex);
  return (
    <svg
      viewBox="0 0 64 64"
      width="100%"
      height="100%"
      className="absolute inset-0 h-full w-full"
      data-portrait-plate={props.plateIndex}
      data-portrait-composition={props.compositionIndex}
    >
      <rect width="64" height="64" fill={fill} />
      {accent}
    </svg>
  );
}

/**
 * Accents live on the frame (corners, outer ring, edge bar) so the
 * center stays clear for initials. Same 6 compositions; different geometry.
 */
function accentShape(compositionIndex: number): ReactNode {
  switch (compositionIndex) {
    case 0:
      return <circle cx="50" cy="50" r="7" fill={ACCENT} />;
    case 1:
      return (
        <rect
          x="4"
          y="4"
          width="56"
          height="56"
          rx="12"
          fill="none"
          stroke={ACCENT}
          strokeWidth="2.5"
        />
      );
    case 2:
      return (
        <line
          x1="6"
          y1="22"
          x2="22"
          y2="6"
          stroke={ACCENT}
          strokeWidth="4"
          strokeLinecap="square"
        />
      );
    case 3:
      return <polygon points="64,0 64,18 46,0" fill={ACCENT} />;
    case 4:
      return (
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke={ACCENT}
          strokeWidth="2.5"
        />
      );
    default:
      return <rect x="0" y="0" width="6" height="64" fill={ACCENT} />;
  }
}

function resolveVisualState(
  state: PortraitState,
  src: string | undefined,
): PortraitState {
  if (state === "ready") {
    if (src == null || src.length === 0) {
      return "invalid";
    }
    return "ready";
  }
  return state;
}

/**
 * Player identity mark. Renders the persisted procedural face when `portrait`
 * is valid, else the deterministic initials plate. Pure props; no client hooks.
 * Always decorative (name is adjacent at every call site).
 */
export function PlayerPortrait(props: PlayerPortraitProps) {
  const face = isValidPortraitAssignment(props.portrait)
    ? props.portrait
    : null;
  const state = resolveVisualState(
    props.state ?? (face !== null ? "assigned" : "missing"),
    props.src,
  );
  const hash = hashPlayerIdForPortrait(props.playerId);
  const plateIndex = portraitPlateIndex(hash);
  const compositionIndex = portraitCompositionIndex(hash);
  const initials = initialsOf(props.firstName, props.lastName);
  const px = PORTRAIT_SIZE_PX[props.size];
  const showOverlay =
    state === "ready" && props.src != null && props.src.length > 0;

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-xl border border-zinc-700",
        SIZE_CLASS[props.size],
        props.className,
      )}
      style={{ width: px, height: px }}
      aria-hidden="true"
      data-portrait-size={props.size}
      data-portrait-state={state}
      data-portrait-player-id={props.playerId}
      data-portrait-uniform={props.uniform ? "team" : undefined}
    >
      {face !== null ? (
        <PortraitFace traits={face.traits} uniform={props.uniform} />
      ) : (
        <>
          <FallbackMark
            plateIndex={plateIndex}
            compositionIndex={compositionIndex}
          />
          <span
            className={cn(
              "relative z-10 flex h-full w-full items-center justify-center font-mono font-semibold text-zinc-50 [text-shadow:0_1px_2px_rgb(0_0_0_/_0.85)]",
              INITIALS_CLASS[props.size],
            )}
          >
            {initials}
          </span>
        </>
      )}
      {showOverlay ? (
        <img
          src={props.src}
          alt=""
          width={px}
          height={px}
          className="absolute inset-0 z-20 h-full w-full object-cover"
        />
      ) : null}
      {state === "pending" ? (
        <span className="pointer-events-none absolute inset-0 z-30 rounded-xl ring-2 ring-inset ring-team-ink" />
      ) : null}
    </span>
  );
}
