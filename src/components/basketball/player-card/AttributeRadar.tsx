import type { PlayerAttributes } from "@/domain/entities/player";
import { categoryRatings } from "@/presentation/player-rating-categories";

const RINGS = [20, 40, 60, 80, 100] as const;
const VIEW_W = 420;
const VIEW_H = 300;
const CX = VIEW_W / 2;
const CY = VIEW_H / 2;
const RADIUS = 92;
const LABEL_GAP = 14;

/**
 * Point on the radar for axis `index` of `count` (axis 0 points straight up,
 * clockwise). `value` is clamped to 0-100 and scaled to `radius`.
 */
export function radarPoint(
  index: number,
  count: number,
  value: number,
  radius: number,
  center: { x: number; y: number } = { x: CX, y: CY },
): { x: number; y: number } {
  const clamped = Math.max(0, Math.min(100, value));
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const r = (clamped / 100) * radius;
  return {
    x: center.x + Math.cos(angle) * r,
    y: center.y + Math.sin(angle) * r,
  };
}

function toPoints(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export function AttributeRadar(props: {
  attributes: PlayerAttributes;
  size?: "sm" | "md";
}) {
  const categories = categoryRatings(props.attributes);
  const count = categories.length;
  const sizeClass = props.size === "md" ? "max-w-md" : "max-w-xs";
  const summary = categories
    .map((c) => `${c.label} ${Math.max(0, Math.min(100, c.rating))}`)
    .join(", ");
  const label = `Attribute radar: ${summary}`;

  const shape = categories.map((c, i) =>
    radarPoint(i, count, c.rating, RADIUS),
  );

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      role="img"
      aria-label={label}
      className={`mx-auto block h-auto w-full ${sizeClass}`}
    >
      <title>Attribute radar</title>
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          points={toPoints(
            categories.map((_, i) => radarPoint(i, count, ring, RADIUS)),
          )}
          fill="none"
          stroke="#3f3f46"
          strokeWidth={ring === 100 ? 1.25 : 0.75}
        />
      ))}
      {categories.map((c, i) => {
        const end = radarPoint(i, count, 100, RADIUS);
        return (
          <line
            key={c.key}
            x1={CX}
            y1={CY}
            x2={end.x}
            y2={end.y}
            stroke="#3f3f46"
            strokeWidth={0.75}
          />
        );
      })}
      <polygon
        points={toPoints(shape)}
        fill="rgb(245 158 11 / 0.28)"
        stroke="#f59e0b"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {shape.map((p, i) => (
        <circle
          key={categories[i].key}
          cx={p.x}
          cy={p.y}
          r={2.5}
          fill="#fbbf24"
        />
      ))}
      {categories.map((c, i) => {
        const p = radarPoint(i, count, 100, RADIUS + LABEL_GAP);
        const dx = p.x - CX;
        const anchor = Math.abs(dx) < 4 ? "middle" : dx > 0 ? "start" : "end";
        return (
          <text
            key={c.key}
            x={p.x}
            y={p.y}
            textAnchor={anchor}
            dominantBaseline="middle"
            fontSize={11}
            fill="#d4d4d8"
          >
            {c.label}{" "}
            <tspan fontWeight={700} fill="#fbbf24">
              {Math.max(0, Math.min(100, c.rating))}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
