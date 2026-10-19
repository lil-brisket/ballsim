import { COURT_FEET as C } from "@/state/watch-court-frame";
import { FULL_COURT_FEET } from "@/state/watch-full-court";

/** Rounds away float noise from derived coordinates. */
function n(value: number): number {
  return Math.round(value * 1000) / 1000;
}

const LENGTH = FULL_COURT_FEET.length;
const WIDTH = FULL_COURT_FEET.width;
const MID_Y = WIDTH / 2;

/** Markings for the basket at one baseline; `left` is x = 0, else x = LENGTH. */
function EndMarkings(props: { left: boolean }) {
  /** Feet from this end's baseline to a screen x. */
  const x = (feet: number): number => n(props.left ? feet : LENGTH - feet);
  /** Arc sweep flag toward the centre of the court, and toward the baseline. */
  const inward = props.left ? 1 : 0;
  const outward = 1 - inward;
  const r = C.freeThrowCircleRadius;
  const cornerTop = MID_Y - C.cornerThreeX;
  const cornerBottom = MID_Y + C.cornerThreeX;
  const hoop = x(C.hoopY);

  return (
    <>
      {/* Lane (16 ft wide, 19 ft deep) and free throw circle */}
      <rect
        x={props.left ? 0 : x(C.laneLength)}
        y={MID_Y - C.laneWidth / 2}
        width={C.laneLength}
        height={C.laneWidth}
      />
      <path
        d={`M${x(C.freeThrowY)} ${MID_Y - r}a${r} ${r} 0 0 ${inward} 0 ${r * 2}`}
      />
      <path
        d={`M${x(C.freeThrowY)} ${MID_Y - r}a${r} ${r} 0 0 ${outward} 0 ${r * 2}`}
        strokeDasharray="1.2 0.9"
      />
      {/* Restricted area, backboard and rim */}
      <path
        d={`M${hoop} ${MID_Y - C.restrictedRadius}a${C.restrictedRadius} ${C.restrictedRadius} 0 0 ${inward} 0 ${C.restrictedRadius * 2}`}
      />
      <line
        x1={n(x(C.backboardY) + 0.25)}
        y1={MID_Y - 3 + 0.3}
        x2={n(x(C.backboardY) + 0.25)}
        y2={MID_Y + 3 + 0.3}
        strokeWidth="0.5"
        stroke="#000000"
        strokeOpacity="0.35"
      />
      <line
        x1={x(C.backboardY)}
        y1={MID_Y - 3}
        x2={x(C.backboardY)}
        y2={MID_Y + 3}
        strokeWidth="0.5"
      />
      <circle
        cx={n(hoop + 0.25)}
        cy={n(MID_Y + 0.3)}
        r={C.rimRadius + 0.01}
        stroke="#000000"
        strokeOpacity="0.35"
      />
      <circle cx={hoop} cy={MID_Y} r={C.rimRadius} />
      {/* Three-point line: 22 ft corners, 23.75 ft arc */}
      <path
        d={`M${x(0)} ${cornerTop}H${x(C.cornerThreeY)}A${C.threeRadius} ${C.threeRadius} 0 0 ${inward} ${x(C.cornerThreeY)} ${cornerBottom}H${x(0)}`}
      />
    </>
  );
}

/**
 * Full-court line markings as an SVG `<g>` for a `0 0 94 50` viewBox, built
 * from `COURT_FEET`. Landscape: baselines are the left and right edges. Strokes
 * use `currentColor`, so tint with a text colour on a parent. Opaque by
 * default: the palette's contrast guarantees assume it.
 */
export function FullCourtLines(props: {
  strokeOpacity?: number;
  /** False when the caller paints its own centre ring. */
  centreCircle?: boolean;
}) {
  return (
    <g
      className="court-lines"
      fill="none"
      stroke="currentColor"
      strokeOpacity={props.strokeOpacity ?? 1}
      strokeWidth="0.2"
    >
      <rect x="0.2" y="0.2" width={LENGTH - 0.4} height={WIDTH - 0.4} />
      <EndMarkings left />
      <EndMarkings left={false} />
      {/* Half-court line and centre circle */}
      <line x1={LENGTH / 2} y1="0" x2={LENGTH / 2} y2={WIDTH} />
      {props.centreCircle === false ? null : (
        <circle cx={LENGTH / 2} cy={MID_Y} r={C.freeThrowCircleRadius} />
      )}
    </g>
  );
}
