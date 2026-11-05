import { COURT_FEET } from "@/state/watch-court-frame";
import { FULL_COURT_FEET } from "@/state/watch-full-court";
import { RIM_HEIGHT_FT, TILT_SQUASH, tiltRaised } from "./court-tilt";

const LENGTH = FULL_COURT_FEET.length;
const WIDTH = FULL_COURT_FEET.width;

/** Off the baseline, where the stanchion stands. */
const POLE_BACK_FT = 0.6;
const BOARD_LOW_FT = 9;
const BOARD_HIGH_FT = 12.5;
const BOARD_HALF_FT = 3;
const BOX_HALF_FT = 1;
const BOX_LOW_FT = 10;
const BOX_HIGH_FT = 11.5;
/**
 * The board is seen nearly edge-on from the side. A slight turn toward the
 * camera lets it read as a board rather than a line.
 */
const BOARD_TURN = 0.35;
/** Drawn larger than regulation so it reads at this size and the ball fits. */
const RIM_RADIUS_FT = 1.15;
const NET_DROP_FT = 1.7;
const NET_TAPER = 0.62;
const NET_STRANDS = 7;
const POLE = "#8d95a1";
const POLE_PAD = "#4a525e";

type End = "left" | "right";
type Xy = { x: number; y: number };

/** A point near a hoop in the floor's `0 0 94 50` box. */
function hoopPoint(
  end: End,
  feetFromBaseline: number,
  side: number,
  height: number,
): Xy & { scale: number } {
  const x =
    (end === "left" ? feetFromBaseline : LENGTH - feetFromBaseline) / LENGTH;
  const placed = tiltRaised({ x, y: 0.5 + side / WIDTH }, height);
  return { x: placed.x * LENGTH, y: placed.y * WIDTH, scale: placed.scale };
}

/** Everything a hoop is made of, on the screen of the tilted floor. */
export function hoopGeometry(end: End) {
  const boardAt = (side: number, height: number) =>
    hoopPoint(end, COURT_FEET.backboardY - side * BOARD_TURN, side, height);
  const rim = hoopPoint(end, COURT_FEET.hoopY, 0, RIM_HEIGHT_FT);
  const rx = RIM_RADIUS_FT * rim.scale;
  const ry = rx * TILT_SQUASH;
  return {
    poleBase: hoopPoint(end, -POLE_BACK_FT, 0, 0),
    poleTop: hoopPoint(end, -POLE_BACK_FT, 0, BOARD_LOW_FT + 0.6),
    armEnd: hoopPoint(end, COURT_FEET.backboardY - 0.3, 0, BOARD_LOW_FT + 0.3),
    board: [
      boardAt(-BOARD_HALF_FT, BOARD_HIGH_FT),
      boardAt(BOARD_HALF_FT, BOARD_HIGH_FT),
      boardAt(BOARD_HALF_FT, BOARD_LOW_FT),
      boardAt(-BOARD_HALF_FT, BOARD_LOW_FT),
    ],
    box: [
      boardAt(-BOX_HALF_FT, BOX_HIGH_FT),
      boardAt(BOX_HALF_FT, BOX_HIGH_FT),
      boardAt(BOX_HALF_FT, BOX_LOW_FT),
      boardAt(-BOX_HALF_FT, BOX_LOW_FT),
    ],
    rimMount: hoopPoint(end, COURT_FEET.backboardY, 0, RIM_HEIGHT_FT),
    rim,
    rx,
    ry,
    netDrop: NET_DROP_FT * 0.77 * rim.scale,
    /** The way the rim's back edge points, to the board. */
    toBoard: end === "left" ? -1 : 1,
  };
}

const points = (list: Xy[]) => list.map((p) => `${p.x},${p.y}`).join(" ");

function HoopBack(props: { end: End }) {
  const h = hoopGeometry(props.end);
  return (
    <>
      {/* Stanchion: a padded base, a pole, and an arm out to the board. */}
      <ellipse
        cx={h.poleBase.x}
        cy={h.poleBase.y}
        rx={1.5}
        ry={1.5 * TILT_SQUASH}
        fill="#000000"
        fillOpacity="0.35"
      />
      <line
        x1={h.poleBase.x}
        y1={h.poleBase.y}
        x2={h.poleTop.x}
        y2={h.poleTop.y}
        stroke={POLE}
        strokeWidth="0.75"
        strokeLinecap="round"
      />
      <line
        x1={h.poleBase.x}
        y1={h.poleBase.y}
        x2={(h.poleBase.x * 2 + h.poleTop.x) / 3}
        y2={(h.poleBase.y * 2 + h.poleTop.y) / 3}
        stroke={POLE_PAD}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <line
        x1={h.poleTop.x}
        y1={h.poleTop.y}
        x2={h.armEnd.x}
        y2={h.armEnd.y}
        stroke={POLE}
        strokeWidth="0.5"
        strokeLinecap="round"
      />
      <polygon
        points={points(h.board)}
        fill="#f4f6f8"
        fillOpacity="0.82"
        stroke="#111318"
        strokeWidth="0.16"
        strokeLinejoin="round"
      />
      <polygon
        points={points(h.box)}
        fill="none"
        stroke="#c8102e"
        strokeWidth="0.12"
      />
      <line
        x1={h.rimMount.x}
        y1={h.rimMount.y}
        x2={h.rim.x + h.toBoard * h.rx}
        y2={h.rim.y}
        stroke="#e2571d"
        strokeWidth="0.26"
      />
      {/* Back half of the rim: the ball passes in front of it. */}
      <path
        d={`M${h.rim.x - h.rx} ${h.rim.y}A${h.rx} ${h.ry} 0 0 1 ${h.rim.x + h.rx} ${h.rim.y}`}
        fill="none"
        stroke="#e2571d"
        strokeWidth="0.26"
      />
    </>
  );
}

function HoopFront(props: { end: End }) {
  const h = hoopGeometry(props.end);
  const low = {
    y: h.rim.y + h.netDrop,
    rx: h.rx * NET_TAPER,
    ry: h.ry * NET_TAPER,
  };
  const strands = Array.from({ length: NET_STRANDS }, (_, i) => {
    const angle = (i / (NET_STRANDS - 1)) * Math.PI;
    return {
      key: i,
      x1: h.rim.x - Math.cos(angle) * h.rx,
      y1: h.rim.y + Math.sin(angle) * h.ry,
      x2: h.rim.x - Math.cos(angle) * low.rx,
      y2: low.y + Math.sin(angle) * low.ry,
    };
  });
  return (
    <>
      <g stroke="#ffffff" strokeOpacity="0.8" strokeWidth="0.09">
        {strands.map((strand) => (
          <line
            key={strand.key}
            x1={strand.x1}
            y1={strand.y1}
            x2={strand.x2}
            y2={strand.y2}
          />
        ))}
        <ellipse
          cx={h.rim.x}
          cy={(h.rim.y + low.y) / 2}
          rx={(h.rx + low.rx) / 2}
          ry={(h.ry + low.ry) / 2}
          fill="none"
        />
        <ellipse cx={h.rim.x} cy={low.y} rx={low.rx} ry={low.ry} fill="none" />
      </g>
      {/* Front half of the rim: the ball drops behind it. */}
      <path
        d={`M${h.rim.x - h.rx} ${h.rim.y}A${h.rx} ${h.ry} 0 0 0 ${h.rim.x + h.rx} ${h.rim.y}`}
        fill="none"
        stroke="#e2571d"
        strokeWidth="0.3"
      />
    </>
  );
}

/**
 * Raised hoops for the tilted camera, drawn in two parts so the ball can pass
 * between them: `back` (stanchion, board, far rim) sits under the ball and
 * `front` (net, near rim) over it. Decorative.
 */
export function CourtHoops(props: { part: "back" | "front" }) {
  return (
    <svg
      aria-hidden="true"
      data-testid={`court-hoops-${props.part}`}
      viewBox={`0 0 ${LENGTH} ${WIDTH}`}
      className={
        props.part === "back"
          ? "pointer-events-none absolute inset-0 z-15 h-full w-full overflow-visible"
          : "pointer-events-none absolute inset-0 z-22 h-full w-full overflow-visible"
      }
    >
      {(["left", "right"] as const).map((end) =>
        props.part === "back" ? (
          <HoopBack key={end} end={end} />
        ) : (
          <HoopFront key={end} end={end} />
        ),
      )}
    </svg>
  );
}
