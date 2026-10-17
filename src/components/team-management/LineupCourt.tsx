import { cn } from "@/components/ui/styles";

/**
 * Static half-court diagram on a 50 x 47 ft viewBox (baseline at the bottom,
 * hoop 5.25 ft from the baseline). Team-tinted lines, no animation.
 */
export function LineupCourt(props: {
  className?: string;
  children?: React.ReactNode;
}) {
  const hoopY = 47 - 5.25;
  return (
    <div
      className={cn(
        "relative mx-auto aspect-[50/47] w-full max-w-xl",
        props.className,
      )}
      data-testid="lineup-court"
    >
      <svg
        viewBox="0 0 50 47"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full rounded-lg text-team-ink"
        style={{ backgroundColor: "rgb(var(--team-primary-rgb) / 0.08)" }}
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.45"
          strokeWidth="0.35"
        >
          <rect x="0.2" y="0.2" width="49.6" height="46.6" />
          {/* Lane (16 ft wide, 19 ft deep) and free throw circle */}
          <rect x="17" y="28" width="16" height="19" />
          <path d="M19 28a6 6 0 0 1 12 0" />
          <path d="M19 28a6 6 0 0 0 12 0" strokeDasharray="1 1" />
          {/* Restricted area, backboard and rim */}
          <path d={`M21 ${hoopY}a4 4 0 0 1 8 0`} />
          <line x1="22" y1="43" x2="28" y2="43" strokeWidth="0.5" />
          <circle cx="25" cy={hoopY} r="0.75" />
          {/* Three-point line: 22 ft corners, 23.75 ft arc */}
          <path d="M3 47V32.8A23.75 23.75 0 0 1 47 32.8V47" />
          {/* Half-court circle */}
          <path d="M19 0a6 6 0 0 0 12 0" />
        </g>
      </svg>
      {props.children}
    </div>
  );
}
