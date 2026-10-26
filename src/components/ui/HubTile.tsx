import Link from "next/link";
import {
  clipCornerClass,
  cn,
  consoleFocusClass,
  displayClass,
} from "@/components/ui/styles";

export type HubTileSize = "hero" | "wide" | "square";

type HubTileBase = {
  title: string;
  size?: HubTileSize;
  stat?: { value: React.ReactNode; label: string };
  /** Decorative portrait / logo / court, placed bottom-right. */
  art?: React.ReactNode;
  /** Count chip, top-right (clear of the cut corner). */
  badge?: React.ReactNode;
  /** Small sentence-case label above the title. */
  eyebrow?: string;
  /** One line of supporting text. */
  children?: React.ReactNode;
  /** Tighter padding, gaps and stat size for boards that must fit one screen. */
  dense?: boolean;
  className?: string;
  /** Position on the board: staggers the entrance (capped at the 5th tile). */
  enterIndex?: number;
  "aria-label"?: string;
};

export type HubTileProps = HubTileBase &
  ({ href: string; onSelect?: never } | { onSelect: () => void; href?: never });

/** The 5th tile onward share one delay, so the last starts by ~240ms. */
const MAX_ENTER_INDEX = 4;

const SPAN: Record<HubTileSize, string> = {
  hero: "min-h-36 sm:col-span-2 sm:row-span-2 sm:min-h-72",
  wide: "min-h-36 sm:col-span-2",
  square: "min-h-36",
};

const SPAN_DENSE: Record<HubTileSize, string> = {
  ...SPAN,
  wide: "min-h-28 sm:col-span-2",
  square: "min-h-28",
};

/**
 * Big focusable hub tile with a cut corner: a link (`href`) or a button
 * (`onSelect`). Use inside a CSS grid; hero spans 2x2 and wide spans 2 columns
 * from `sm` up, and everything is a single column on phones.
 */
export function HubTile(props: HubTileProps) {
  const size = props.size ?? "square";
  const hero = size === "hero";
  const dense = props.dense === true && !hero;
  const className = cn(
    consoleFocusClass,
    "group block min-h-11 text-left touch-manipulation",
    props.enterIndex !== undefined && "enter-up tile-enter",
    (dense ? SPAN_DENSE : SPAN)[size],
    props.className,
  );
  const style =
    props.enterIndex !== undefined
      ? ({
          "--i": Math.min(props.enterIndex, MAX_ENTER_INDEX),
        } as React.CSSProperties)
      : undefined;
  const content = (
    <>
      <span
        aria-hidden
        className={cn(clipCornerClass, "absolute inset-0")}
        style={{ background: "var(--edge)" }}
      />
      <span
        aria-hidden
        className={cn(clipCornerClass, "absolute inset-[2px]")}
        style={{
          background:
            "linear-gradient(180deg, rgb(255 255 255 / 0.06), transparent 40%), var(--tile-surface)",
        }}
      />
      {props.art ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 flex max-h-full max-w-[45%] items-end justify-end overflow-hidden p-3 opacity-90"
        >
          {props.art}
        </span>
      ) : null}
      {props.badge ? (
        <span className="absolute right-6 top-3 z-10">{props.badge}</span>
      ) : null}
      <span
        className={cn(
          "relative flex h-full min-h-[inherit] flex-col justify-between",
          dense ? "gap-1" : "gap-4",
          hero ? "p-5 sm:p-6" : dense ? "p-3" : "p-4",
        )}
      >
        <span className={cn("block min-w-0", props.badge ? "pr-14" : "pr-6")}>
          {props.eyebrow ? (
            <span className="mb-1 block text-sm text-muted">
              {props.eyebrow}
            </span>
          ) : null}
          <span
            className={cn(
              displayClass,
              // Wrap between words only; never split a word mid-way.
              "block text-balance",
              hero
                ? "text-3xl sm:text-4xl"
                : size === "wide"
                  ? "text-xl"
                  : "text-lg sm:text-xl",
            )}
          >
            {props.title}
          </span>
          {props.children ? (
            <span
              className={cn(
                "block text-sm text-muted",
                dense ? "mt-1" : "mt-2",
              )}
            >
              {props.children}
            </span>
          ) : null}
        </span>
        {props.stat ? (
          <span className="block">
            <span
              className={cn(
                "font-display block font-bold tabular-nums leading-none text-ink",
                hero ? "text-6xl sm:text-7xl" : dense ? "text-3xl" : "text-4xl",
              )}
            >
              {props.stat.value}
            </span>
            <span className={cn("block text-sm text-muted", !dense && "mt-1")}>
              {props.stat.label}
            </span>
          </span>
        ) : null}
      </span>
    </>
  );

  if (props.href !== undefined) {
    return (
      <Link
        href={props.href}
        aria-label={props["aria-label"]}
        data-shape="corner"
        data-focus-item=""
        className={className}
        style={style}
      >
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={props.onSelect}
      aria-label={props["aria-label"]}
      data-shape="corner"
      data-focus-item=""
      className={className}
      style={style}
    >
      {content}
    </button>
  );
}
