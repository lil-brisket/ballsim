import { cn } from "@/components/ui/styles";
import { ratingTier } from "@/presentation/rating-tier";

export type OvrBadgeSize = "sm" | "md" | "lg" | "xl";

const HEX_CLIP =
  "polygon(50% 0%, 100% 18%, 100% 78%, 50% 100%, 0% 78%, 0% 18%)";

const BOX: Record<OvrBadgeSize, string> = {
  sm: "h-8 w-7",
  md: "h-11 w-10",
  lg: "h-[4.5rem] w-16",
  xl: "h-36 w-32",
};

const INSET: Record<OvrBadgeSize, string> = {
  sm: "inset-[1.5px]",
  md: "inset-[2px]",
  lg: "inset-[3px]",
  xl: "inset-[3px]",
};

const NUMBER: Record<OvrBadgeSize, string> = {
  sm: "text-sm",
  md: "text-xl",
  lg: "text-3xl",
  xl: "text-6xl",
};

/**
 * Hex overall-rating badge coloured by rating tier. `ghost` is the outline-only
 * potential style. The number is the display font; `label` shows under the
 * number for lg/xl.
 */
export function OvrBadge(props: {
  overall: number;
  size?: OvrBadgeSize;
  ghost?: boolean;
  label?: string;
  className?: string;
}) {
  const size = props.size ?? "md";
  const big = size === "lg" || size === "xl";
  const label = props.label ?? "OVR";
  const name = props.label
    ? `${props.label} ${props.overall}`
    : props.ghost
      ? `Potential ${props.overall}`
      : `Overall ${props.overall}`;
  return (
    <span
      role="img"
      aria-label={name}
      data-tier={ratingTier(props.overall).id}
      className={cn(
        "relative inline-block shrink-0",
        BOX[size],
        props.className,
      )}
      style={
        big
          ? {
              filter: `drop-shadow(0 0 ${size === "xl" ? 14 : 8}px rgb(var(--tier-rgb) / ${props.ghost ? 0.25 : 0.6}))`,
            }
          : undefined
      }
    >
      <span
        aria-hidden
        className={cn("absolute inset-0 bg-tier", props.ghost && "opacity-60")}
        style={{ clipPath: HEX_CLIP }}
      />
      <span
        aria-hidden
        className={cn(
          "absolute flex flex-col items-center justify-center gap-0.5",
          INSET[size],
          props.ghost ? "bg-surface-deep/80" : "bg-surface-deep",
        )}
        style={{ clipPath: HEX_CLIP }}
      >
        <span
          aria-hidden
          className={cn(
            "font-display font-bold tabular-nums leading-none text-tier",
            NUMBER[size],
            props.ghost && "opacity-70",
          )}
        >
          {props.overall}
        </span>
        {big ? (
          <span aria-hidden className="text-sm leading-none text-muted">
            {label}
          </span>
        ) : null}
      </span>
    </span>
  );
}
