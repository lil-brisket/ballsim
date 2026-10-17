import { HalfCourtLines } from "@/components/game/court/HalfCourtLines";
import { cn } from "@/components/ui/styles";

/**
 * Static half-court diagram on a 50 x 47 ft viewBox (baseline at the bottom,
 * hoop 5.25 ft from the baseline; lines from HalfCourtLines). Team-tinted
 * lines, no animation.
 */
export function LineupCourt(props: {
  className?: string;
  children?: React.ReactNode;
}) {
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
        <HalfCourtLines orientation="basket-bottom" />
      </svg>
      {props.children}
    </div>
  );
}
