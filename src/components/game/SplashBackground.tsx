import type { CSSProperties } from "react";

const lineStyle = (i: number) => ({ "--i": i }) as CSSProperties;

/**
 * CSS/SVG arena atmosphere for splash and home: a top spotlight, a faint
 * hardwood texture and one half-court diagram. No image assets.
 *
 * The court is drawn in feet on a 50 x 47 half court (baseline at the bottom,
 * rim 5.25 from the baseline, centre x = 25): key 16 x 19, free-throw circle
 * r6, restricted arc r4, three-point arc r23.75 with corner lines 3 from each
 * sideline (they meet the arc at y = 5.25 + sqrt(23.75^2 - 22^2) = 14.2).
 * The group is flipped so y = 0 is the baseline.
 */
export function SplashBackground(props: {
  className?: string;
  /** Stronger court lines for the splash; other pages keep them subtle. */
  prominent?: boolean;
}) {
  return (
    <div
      className={`court-line-animate pointer-events-none absolute inset-0 overflow-hidden ${props.className ?? ""}`}
      aria-hidden
      suppressHydrationWarning
    >
      <div className="splash-court absolute inset-0" />
      <div className="splash-floor absolute inset-0" />
      <div className="splash-spotlight absolute inset-0" />
      <div className="splash-vignette absolute inset-0" />
      <svg
        className={`splash-court-lines absolute inset-0 h-full w-full text-zinc-300 ${props.prominent ? "opacity-[0.22]" : "opacity-[0.09]"}`}
        viewBox="0 0 50 47"
        preserveAspectRatio="xMidYMax slice"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.2"
        strokeLinecap="round"
        suppressHydrationWarning
      >
        <g transform="translate(0 47) scale(1 -1)">
          {/* Court boundary: baseline, sidelines, half-court line. */}
          <rect
            pathLength="1"
            style={lineStyle(0)}
            x="0"
            y="0"
            width="50"
            height="47"
            className="court-line"
            suppressHydrationWarning
          />
          {/* Key: 16 wide, 19 deep. */}
          <rect
            pathLength="1"
            style={lineStyle(1)}
            x="17"
            y="0"
            width="16"
            height="19"
            className="court-line"
            suppressHydrationWarning
          />
          {/* Free-throw circle: solid outside the key, dashed inside. */}
          <path
            pathLength="1"
            style={lineStyle(2)}
            d="M19 19A6 6 0 0 0 31 19"
            className="court-line"
            suppressHydrationWarning
          />
          <path d="M19 19A6 6 0 0 1 31 19" strokeDasharray="0.6 0.6" />
          {/* Backboard, rim and restricted-area arc. */}
          <line
            pathLength="1"
            style={lineStyle(3)}
            x1="22"
            y1="4"
            x2="28"
            y2="4"
            className="court-line"
            suppressHydrationWarning
          />
          <circle
            pathLength="1"
            style={lineStyle(3)}
            cx="25"
            cy="5.25"
            r="0.75"
            className="court-line"
            suppressHydrationWarning
          />
          <path
            pathLength="1"
            style={lineStyle(4)}
            d="M21 5.25A4 4 0 0 0 29 5.25"
            className="court-line"
            suppressHydrationWarning
          />
          {/* Three-point line: corner lines plus an r23.75 arc about the rim. */}
          <path
            pathLength="1"
            style={lineStyle(5)}
            d="M3 0V14.2A23.75 23.75 0 1 0 47 14.2V0"
            className="court-line"
            suppressHydrationWarning
          />
          {/* Half-court circle (r6) at the far end. */}
          <path
            pathLength="1"
            style={lineStyle(6)}
            d="M19 47A6 6 0 0 1 31 47"
            className="court-line"
            suppressHydrationWarning
          />
        </g>
      </svg>
    </div>
  );
}
