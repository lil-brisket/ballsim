import type { ReactNode } from "react";
import type { PortraitTraits } from "@/domain/entities/player-portrait";

/**
 * Procedural headshot drawn from persisted trait indices.
 * Pure SVG: no hooks, no randomness, no image assets. Layer order:
 * plate → back hair → shoulders → neck → ears → head → features → hair → accessory.
 */

const SKIN = [
  "#f6d7c3",
  "#eac0a0",
  "#d9a47f",
  "#c68a63",
  "#b07250",
  "#9a5f3f",
  "#7f4a2e",
  "#683b24",
  "#53301d",
  "#3f2516",
] as const;

const SKIN_SHADOW = [
  "#dcb39b",
  "#cf9f7f",
  "#bd8660",
  "#a96f4b",
  "#925b3b",
  "#7e4b30",
  "#663a23",
  "#522d1b",
  "#402315",
  "#2e1a0f",
] as const;

const HAIR = [
  "#111111",
  "#1d1a1f",
  "#2b1b12",
  "#4a2f1d",
  "#6b2f1a",
  "#8a6a3b",
  "#c49a52",
] as const;

const FEATURE = "#1a1210";
const PLATE = "#27272a";
const JERSEY = "#3f3f46";
const ACCENT = "#d97706";

/** Cap that follows the top of the skull; shared by short styles. */
const CAP_PATH =
  "M19 27 C18.5 15.5 24.5 12.5 32 12.5 C39.5 12.5 45.5 15.5 45 27 C43 20.5 38.5 18 32 18 C25.5 18 21 20.5 19 27 Z";

function head(shape: number, fill: string): ReactNode {
  switch (shape) {
    case 1:
      return <ellipse cx="32" cy="29" rx="13.5" ry="14.5" fill={fill} />;
    case 2:
      return <ellipse cx="32" cy="29" rx="11.5" ry="15.5" fill={fill} />;
    case 3:
      return (
        <rect x="19.5" y="14" width="25" height="30" rx="10" fill={fill} />
      );
    default:
      return <ellipse cx="32" cy="29" rx="12.5" ry="15" fill={fill} />;
  }
}

function backHair(style: number, color: string): ReactNode {
  switch (style) {
    case 4:
      return <circle cx="32" cy="22" r="16.5" fill={color} />;
    case 7:
      return (
        <path
          d="M17 26 C16 12 24 9 32 9 C40 9 48 12 47 26 L48 46 L42 46 L41 30 L23 30 L22 46 L16 46 Z"
          fill={color}
        />
      );
    case 13:
      return (
        <path
          d="M17.5 27 C16.5 13 24 10.5 32 10.5 C40 10.5 47.5 13 46.5 27 L47 42 C45 44 43 44 42 42 L41 28 L23 28 L22 42 C21 44 19 44 17 42 Z"
          fill={color}
        />
      );
    default:
      return null;
  }
}

function frontHair(style: number, color: string): ReactNode {
  switch (style) {
    case 0:
      return null;
    case 1:
      return <path d={CAP_PATH} fill={color} opacity="0.55" />;
    case 2:
      return <path d={CAP_PATH} fill={color} />;
    case 3:
      return (
        <g>
          <path d={CAP_PATH} fill={color} />
          <path
            d="M23 17 Q27 15.5 31 17 T39 17 M22 20.5 Q26 19 30 20.5 T38 20.5"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.18"
            strokeWidth="0.8"
          />
        </g>
      );
    case 4:
      return <path d={CAP_PATH} fill={color} />;
    case 5:
      return (
        <g>
          <rect x="20" y="4.5" width="24" height="15" rx="3" fill={color} />
          <path d={CAP_PATH} fill={color} />
        </g>
      );
    case 6:
      return (
        <g>
          <path d={CAP_PATH} fill={color} />
          <path
            d="M26 13.5 L24 23 M30 12.8 L29.5 19 M34 12.8 L34.5 19 M38 13.5 L40 23"
            stroke="#ffffff"
            strokeOpacity="0.2"
            strokeWidth="0.8"
          />
        </g>
      );
    case 7:
      return (
        <g>
          <path d={CAP_PATH} fill={color} />
          <path
            d="M20 22 L19.5 34 M44 22 L44.5 34"
            stroke={color}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>
      );
    case 8:
      return (
        <g fill={color}>
          <path d={CAP_PATH} />
          <circle cx="23" cy="15" r="4" />
          <circle cx="29" cy="11.5" r="4.2" />
          <circle cx="35" cy="11.5" r="4.2" />
          <circle cx="41" cy="15" r="4" />
        </g>
      );
    case 9:
      return (
        <g fill={color}>
          <path d={CAP_PATH} />
          <circle cx="22.5" cy="17" r="2.4" />
          <circle cx="26.5" cy="13.5" r="2.4" />
          <circle cx="32" cy="12" r="2.4" />
          <circle cx="37.5" cy="13.5" r="2.4" />
          <circle cx="41.5" cy="17" r="2.4" />
        </g>
      );
    case 10:
      return (
        <g fill={color}>
          <path d={CAP_PATH} />
          <circle cx="32" cy="9.5" r="4.2" />
        </g>
      );
    case 11:
      return (
        <g fill={color}>
          <path d={CAP_PATH} opacity="0.3" />
          <rect x="28.5" y="6" width="7" height="14" rx="3" />
        </g>
      );
    case 12:
      return (
        <g>
          <path
            d="M19 27 C18.5 14 25 11.5 33 12 C40 12.5 45.5 15.5 45 27 C43.5 21 41 19 36 18.5 C31 18 25 18.5 19 27 Z"
            fill={color}
          />
          <path
            d="M27 12.6 L25.5 19.5"
            stroke="#000000"
            strokeOpacity="0.35"
            strokeWidth="0.9"
          />
        </g>
      );
    default:
      return <path d={CAP_PATH} fill={color} />;
  }
}

function brows(variant: number, color: string): ReactNode {
  switch (variant) {
    case 1:
      return (
        <path
          d="M23.5 24.5 L29.5 24 M34.5 24 L40.5 24.5"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
        />
      );
    case 2:
      return (
        <path
          d="M23.5 23.5 L29.5 25 M34.5 25 L40.5 23.5"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      );
    case 3:
      return (
        <path
          d="M23.5 25 Q26.5 22.5 29.5 24.5 M34.5 24.5 Q37.5 22.5 40.5 25"
          fill="none"
          stroke={color}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      );
    default:
      return (
        <path
          d="M24 24.5 L29.5 24.5 M34.5 24.5 L40 24.5"
          stroke={color}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      );
  }
}

function eyes(variant: number): ReactNode {
  switch (variant) {
    case 1:
      return (
        <g>
          <ellipse cx="27" cy="28.5" rx="2.3" ry="1.5" fill="#f4f4f5" />
          <ellipse cx="37" cy="28.5" rx="2.3" ry="1.5" fill="#f4f4f5" />
          <circle cx="27" cy="28.5" r="1.1" fill={FEATURE} />
          <circle cx="37" cy="28.5" r="1.1" fill={FEATURE} />
        </g>
      );
    case 2:
      return (
        <g fill={FEATURE}>
          <rect x="25" y="28" width="4" height="1.2" rx="0.6" />
          <rect x="35" y="28" width="4" height="1.2" rx="0.6" />
        </g>
      );
    case 3:
      return (
        <g fill={FEATURE}>
          <circle cx="27" cy="28.5" r="1.8" />
          <circle cx="37" cy="28.5" r="1.8" />
        </g>
      );
    default:
      return (
        <g fill={FEATURE}>
          <circle cx="27" cy="28.5" r="1.3" />
          <circle cx="37" cy="28.5" r="1.3" />
        </g>
      );
  }
}

function nose(variant: number, shadow: string): ReactNode {
  switch (variant) {
    case 1:
      return <ellipse cx="32" cy="34" rx="3.2" ry="1.6" fill={shadow} />;
    case 2:
      return (
        <path
          d="M32.5 29.5 L30.5 34.5 L33.5 34.5"
          fill="none"
          stroke={shadow}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 3:
      return <path d="M32 30 L34.5 35 L29.5 35 Z" fill={shadow} />;
    default:
      return (
        <path
          d="M30 34.5 Q32 36 34 34.5"
          fill="none"
          stroke={shadow}
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      );
  }
}

function mouth(variant: number, shadow: string): ReactNode {
  switch (variant) {
    case 1:
      return (
        <path
          d="M28 38.5 Q32 41 36 38.5"
          fill="none"
          stroke={FEATURE}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      );
    case 2:
      return (
        <g>
          <path d="M27.5 38 Q32 42.5 36.5 38 Z" fill={FEATURE} />
          <path d="M28.5 38.4 L35.5 38.4" stroke="#f4f4f5" strokeWidth="0.9" />
        </g>
      );
    case 3:
      return (
        <g>
          <path
            d="M29.5 38.5 L34.5 38.5"
            stroke={FEATURE}
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <path
            d="M30 40 Q32 41 34 40"
            fill="none"
            stroke={shadow}
            strokeWidth="1"
            strokeLinecap="round"
          />
        </g>
      );
    default:
      return (
        <path
          d="M28.5 38.5 L35.5 38.5"
          stroke={FEATURE}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      );
  }
}

function facialHair(variant: number, color: string): ReactNode {
  switch (variant) {
    case 1:
      return (
        <path
          d="M20.5 32 C21 42 26 45 32 45 C38 45 43 42 43.5 32 C41 39 37 41 32 41 C27 41 23 39 20.5 32 Z"
          fill={color}
          opacity="0.28"
        />
      );
    case 2:
      return (
        <path
          d="M27.5 37 Q32 35 36.5 37 L36 38 Q32 36.8 28 38 Z"
          fill={color}
        />
      );
    case 3:
      return <path d="M29 40.5 L35 40.5 L34 45 L30 45 Z" fill={color} />;
    case 4:
      return (
        <path
          d="M20 29 C20 42 25 46.5 32 46.5 C39 46.5 44 42 44 29 C43 36 41 37.5 37 37 Q32 35 27 37 C23 37.5 21 36 20 29 Z M28.5 38.5 Q32 41 35.5 38.5 L35 40 Q32 41.5 29 40 Z"
          fill={color}
          fillRule="evenodd"
        />
      );
    case 5:
      return (
        <path
          d="M20 29 C20 42 25 46 32 46 C39 46 44 42 44 29 L42.5 30 C42 40 38 43.5 32 43.5 C26 43.5 22 40 21.5 30 Z"
          fill={color}
        />
      );
    case 6:
      return (
        <g fill={color}>
          <path d="M27.5 37 Q32 35 36.5 37 L36 38 Q32 36.8 28 38 Z" />
          <path d="M29.5 40.5 L34.5 40.5 L33.5 44.5 L30.5 44.5 Z" />
        </g>
      );
    default:
      return null;
  }
}

/** 0–1: none (most players), 2: headband, 3: ear stud. */
function accessory(variant: number): ReactNode {
  switch (variant) {
    case 2:
      return (
        <rect x="19" y="18" width="26" height="3.2" rx="1.6" fill="#e4e4e7" />
      );
    case 3:
      return <circle cx="19.5" cy="33.5" r="0.9" fill="#e4e4e7" />;
    default:
      return null;
  }
}

const EAR_RX = [2.2, 2.8, 3.4] as const;

export function PortraitFace(props: { traits: PortraitTraits }) {
  const t = props.traits;
  const skin = SKIN[t.skinTone] ?? SKIN[0];
  const shadow = SKIN_SHADOW[t.skinTone] ?? SKIN_SHADOW[0];
  const hair = HAIR[t.hairColor] ?? HAIR[0];
  const earRx = EAR_RX[t.ears] ?? EAR_RX[0];

  return (
    <svg
      viewBox="0 0 64 64"
      width="100%"
      height="100%"
      className="absolute inset-0 h-full w-full"
      data-portrait-face="true"
    >
      <rect width="64" height="64" fill={PLATE} />
      {backHair(t.hairStyle, hair)}
      <path d="M4 64 C6 52 18 48 32 48 C46 48 58 52 60 64 Z" fill={JERSEY} />
      <path
        d="M26 48.5 L32 55 L38 48.5"
        fill="none"
        stroke={ACCENT}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="27" y="39" width="10" height="11" rx="3" fill={shadow} />
      <ellipse cx="19.5" cy="30" rx={earRx} ry="4" fill={shadow} />
      <ellipse cx="44.5" cy="30" rx={earRx} ry="4" fill={shadow} />
      {head(t.faceShape, skin)}
      {brows(t.brows, hair)}
      {eyes(t.eyes)}
      {nose(t.nose, shadow)}
      {facialHair(t.facialHair, hair)}
      {mouth(t.mouth, shadow)}
      {frontHair(t.hairStyle, hair)}
      {accessory(t.accessory)}
    </svg>
  );
}
