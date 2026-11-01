import type { ReactNode } from "react";
import {
  hashPlayerIdForPortrait,
  portraitCompositionIndex,
  portraitPlateIndex,
} from "@/presentation/portrait-hash";
import { cn } from "@/components/ui/styles";
import { contrastRatio } from "@/domain/color-contrast";
import {
  PortraitFace,
  uniformColors,
  type PortraitUniform,
} from "@/components/basketball/PortraitFace";
import {
  isValidPortraitAssignment,
  type PlayerPortraitAssignment,
} from "@/domain/entities/player-portrait";
import {
  PORTRAIT_LIBRARY_IMAGE_SIZES,
  PORTRAIT_LIBRARY_PUBLIC_DIR,
} from "@/domain/portrait-library";

/** Which layer drew the portrait: shared library image, procedural SVG, or initials. */
export type PortraitSource = "library" | "face" | "initials";

export type PlayerPortraitSize = "xs" | "sm" | "ms" | "md" | "lg" | "xl";

export type PlayerPortraitProps = {
  playerId: string;
  firstName: string;
  lastName: string;
  size: PlayerPortraitSize;
  /**
   * Persisted portrait (world.playerPortraits). A valid `libraryId` renders the
   * shared library image; otherwise the procedural face; invalid/null → initials plate.
   */
  portrait?: PlayerPortraitAssignment | null;
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
  sm: "text-xs",
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

/** The team colour that stands out more on the dark plates; amber without a team. */
function fallbackAccent(uniform: PortraitUniform | null | undefined): string {
  if (!uniform) return uniformColors(null).trim;
  const onPlate = (hex: string) => contrastRatio(hex, PLATE_FILLS[0]) ?? 0;
  return onPlate(uniform.primaryColor) >= onPlate(uniform.secondaryColor)
    ? uniform.primaryColor
    : uniform.secondaryColor;
}

function initialsOf(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase();
}

function FallbackMark(props: {
  plateIndex: number;
  compositionIndex: number;
  accentColor: string;
}): ReactNode {
  const fill = PLATE_FILLS[props.plateIndex] ?? PLATE_FILLS[0];
  const accent = accentShape(props.compositionIndex, props.accentColor);
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
function accentShape(compositionIndex: number, color: string): ReactNode {
  switch (compositionIndex) {
    case 0:
      return <circle cx="50" cy="50" r="7" fill={color} />;
    case 1:
      return (
        <rect
          x="4"
          y="4"
          width="56"
          height="56"
          rx="12"
          fill="none"
          stroke={color}
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
          stroke={color}
          strokeWidth="4"
          strokeLinecap="square"
        />
      );
    case 3:
      return <polygon points="64,0 64,18 46,0" fill={color} />;
    case 4:
      return (
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
        />
      );
    default:
      return <rect x="0" y="0" width="6" height="64" fill={color} />;
  }
}

const LIBRARY_ROOT = `/${PORTRAIT_LIBRARY_PUBLIC_DIR}`;

/** Neutral backdrop when no team colours are given. */
const NEUTRAL_BACKDROP = "linear-gradient(160deg, #3f3f46 0%, #18181b 100%)";

function librarySrcSet(libraryId: string): string {
  return PORTRAIT_LIBRARY_IMAGE_SIZES.map(
    (size) => `${LIBRARY_ROOT}/${size}/${libraryId}.webp ${size}w`,
  ).join(", ");
}

/**
 * Shared-library image, composited so team colours still apply: a team-colour
 * backdrop behind the transparent portrait, and the team colour multiplied into
 * the white jersey only (the per-image alpha mask keeps skin and hair untouched).
 */
function LibraryPortrait(props: {
  libraryId: string;
  px: number;
  uniform: PortraitUniform | null | undefined;
}): ReactNode {
  const { jersey, trim } = uniformColors(props.uniform);
  const mask = `url(${LIBRARY_ROOT}/mask/${props.libraryId}.webp)`;
  const backdrop = props.uniform
    ? `radial-gradient(circle at 50% 30%, color-mix(in srgb, ${trim} 60%, #09090b) 0%, #09090b 100%)`
    : NEUTRAL_BACKDROP;
  return (
    <>
      <span
        className="absolute inset-0"
        style={{ background: backdrop }}
        data-portrait-library={props.libraryId}
      />
      <img
        src={`${LIBRARY_ROOT}/256/${props.libraryId}.webp`}
        srcSet={librarySrcSet(props.libraryId)}
        sizes={`${props.px}px`}
        alt=""
        width={props.px}
        height={props.px}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span
        className="absolute inset-0"
        style={{
          backgroundColor: jersey,
          mixBlendMode: "multiply",
          maskImage: mask,
          WebkitMaskImage: mask,
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
        }}
      />
    </>
  );
}

/**
 * Player identity mark. Renders the shared library image when `portrait` has a
 * library id, else the persisted procedural face, else the deterministic
 * initials plate. Pure props; no client hooks. Always decorative (name is
 * adjacent at every call site).
 */
export function PlayerPortrait(props: PlayerPortraitProps) {
  const face = isValidPortraitAssignment(props.portrait)
    ? props.portrait
    : null;
  const libraryId = face?.libraryId;
  const source: PortraitSource =
    libraryId !== undefined ? "library" : face !== null ? "face" : "initials";
  const hash = hashPlayerIdForPortrait(props.playerId);
  const plateIndex = portraitPlateIndex(hash);
  const compositionIndex = portraitCompositionIndex(hash);
  const initials = initialsOf(props.firstName, props.lastName);
  const px = PORTRAIT_SIZE_PX[props.size];

  return (
    <span
      className={cn(
        "relative isolate inline-flex shrink-0 overflow-hidden rounded-xl border border-line-strong",
        SIZE_CLASS[props.size],
        props.className,
      )}
      style={{ width: px, height: px }}
      aria-hidden="true"
      data-portrait-size={props.size}
      data-portrait-source={source}
      data-portrait-player-id={props.playerId}
      data-portrait-uniform={props.uniform ? "team" : undefined}
    >
      {libraryId !== undefined ? (
        <LibraryPortrait
          libraryId={libraryId}
          px={px}
          uniform={props.uniform}
        />
      ) : face !== null ? (
        <PortraitFace traits={face.traits} uniform={props.uniform} />
      ) : (
        <>
          <FallbackMark
            plateIndex={plateIndex}
            compositionIndex={compositionIndex}
            accentColor={fallbackAccent(props.uniform)}
          />
          <span
            className={cn(
              "relative z-10 flex h-full w-full items-center justify-center font-mono font-semibold text-ink [text-shadow:0_1px_2px_rgb(0_0_0_/_0.85)]",
              INITIALS_CLASS[props.size],
            )}
          >
            {initials}
          </span>
        </>
      )}
    </span>
  );
}
