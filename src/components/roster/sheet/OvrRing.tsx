import { cn } from "@/components/ui/styles";
import { ratingTier } from "@/presentation/rating-tier";

const SIZES = {
  md: { box: "h-14 w-14", number: "text-2xl" },
  lg: { box: "h-20 w-20", number: "text-4xl" },
} as const;

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Overall as a circular progress ring (overall / 99) in the rating tier
 * colour, with the number in the display font. The fill transition is off
 * under reduced motion.
 */
export function OvrRing(props: {
  overall: number;
  /** Spoken label; defaults to "Overall <n>". Scouted estimates override it. */
  label?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const size = SIZES[props.size ?? "md"];
  const progress = Math.min(1, Math.max(0, props.overall / 99));
  return (
    <span
      role="img"
      aria-label={props.label ?? `Overall ${props.overall}`}
      data-tier={ratingTier(props.overall).id}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        size.box,
        props.className,
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full -rotate-90"
      >
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          className="stroke-surface-line"
        />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className="stroke-tier transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
        />
      </svg>
      <span
        aria-hidden
        className={cn(
          "font-display font-bold leading-none tabular-nums text-tier",
          size.number,
        )}
      >
        {props.overall}
      </span>
    </span>
  );
}
