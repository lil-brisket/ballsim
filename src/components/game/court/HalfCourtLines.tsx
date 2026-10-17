import { COURT_FEET as C } from "@/state/watch-court-frame";

export type HalfCourtOrientation = "basket-top" | "basket-bottom";

/** Rounds away float noise from derived coordinates. */
function n(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Half-court line markings as an SVG `<g>` for a `0 0 50 47` viewBox, built
 * from `COURT_FEET`. `basket-bottom` puts the baseline at the bottom of the
 * viewBox (lineup diagram); `basket-top` puts it at the top (court replay).
 * Strokes use `currentColor`, so tint with a text colour class on the `<svg>`.
 */
export function HalfCourtLines(props: {
  orientation: HalfCourtOrientation;
  strokeOpacity?: number;
}) {
  const bottom = props.orientation === "basket-bottom";
  /** Feet from the baseline to a screen y. */
  const y = (feet: number): number => n(bottom ? C.length - feet : feet);
  /** SVG arc sweep flags: away from the baseline, and toward it. */
  const away = bottom ? 1 : 0;
  const toward = 1 - away;
  const cornerLeft = C.hoopX - C.cornerThreeX;
  const cornerRight = C.hoopX + C.cornerThreeX;
  const laneLeft = C.hoopX - C.laneWidth / 2;
  const circleLeft = C.hoopX - C.freeThrowCircleRadius;
  const circleDiameter = C.freeThrowCircleRadius * 2;
  const restrictedLeft = C.hoopX - C.restrictedRadius;
  const hoopScreenY = y(C.hoopY);
  const lane = y(C.freeThrowY);

  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeOpacity={props.strokeOpacity ?? 0.45}
      strokeWidth="0.35"
    >
      <rect x="0.2" y="0.2" width={C.width - 0.4} height={C.length - 0.4} />
      {/* Lane (16 ft wide, 19 ft deep) and free throw circle */}
      <rect
        x={laneLeft}
        y={bottom ? lane : 0}
        width={C.laneWidth}
        height={C.laneLength}
      />
      <path
        d={`M${circleLeft} ${lane}a${C.freeThrowCircleRadius} ${C.freeThrowCircleRadius} 0 0 ${away} ${circleDiameter} 0`}
      />
      <path
        d={`M${circleLeft} ${lane}a${C.freeThrowCircleRadius} ${C.freeThrowCircleRadius} 0 0 ${toward} ${circleDiameter} 0`}
        strokeDasharray="1 1"
      />
      {/* Restricted area, backboard and rim */}
      <path
        d={`M${restrictedLeft} ${hoopScreenY}a${C.restrictedRadius} ${C.restrictedRadius} 0 0 ${away} ${C.restrictedRadius * 2} 0`}
      />
      <line
        x1={C.hoopX - 3}
        y1={y(C.backboardY)}
        x2={C.hoopX + 3}
        y2={y(C.backboardY)}
        strokeWidth="0.5"
      />
      <circle cx={C.hoopX} cy={hoopScreenY} r={C.rimRadius} />
      {/* Three-point line: 22 ft corners, 23.75 ft arc */}
      <path
        d={`M${cornerLeft} ${y(0)}V${y(C.cornerThreeY)}A${C.threeRadius} ${C.threeRadius} 0 0 ${away} ${cornerRight} ${y(C.cornerThreeY)}V${y(0)}`}
      />
      {/* Half-court circle */}
      <path
        d={`M${circleLeft} ${y(C.length)}a${C.freeThrowCircleRadius} ${C.freeThrowCircleRadius} 0 0 ${toward} ${circleDiameter} 0`}
      />
    </g>
  );
}
