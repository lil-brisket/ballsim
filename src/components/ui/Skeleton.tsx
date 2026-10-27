import { cn } from "@/components/ui/styles";

/**
 * Loading placeholders for `loading.tsx`. Every piece is decorative
 * (`aria-hidden`); wrap a whole screen in `SkeletonScreen` so assistive tech
 * gets exactly one "Loading…" status. The shimmer is the `.skeleton` class in
 * globals.css (static under reduced motion). Geometry mirrors the loaded
 * pages so the swap does not shift the layout.
 */

/** Rounded surface block; size it with `className` (e.g. `h-24 w-40`). */
export function SkeletonBlock(props: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      data-skeleton=""
      className={cn("skeleton rounded-xl", props.className)}
    />
  );
}

/** One page of skeleton with a single visually hidden live status. */
export function SkeletonScreen(props: {
  children: React.ReactNode;
  message?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col", props.className ?? "gap-6")}>
      <p role="status" className="sr-only">
        {props.message ?? "Loading…"}
      </p>
      <div aria-hidden="true" className="contents">
        {props.children}
      </div>
    </div>
  );
}

/** Home: hero, recent-results strip, then the eight-tile board. */
export function SkeletonTileBoard(props: {
  /** Four tiles, no hero or results strip (e.g. Trades). */
  compact?: boolean;
  className?: string;
}) {
  const tiles = props.compact
    ? ["min-h-28", "min-h-28", "min-h-28 sm:col-span-2", "min-h-28"]
    : [
        "min-h-[8.875rem]",
        "min-h-[8.875rem]",
        "min-h-[8.875rem] sm:col-span-2",
        "min-h-[8.875rem]",
        "min-h-[7.625rem]",
        "min-h-[7.625rem] sm:col-span-2",
        "min-h-[7.625rem]",
        "min-h-[7.625rem]",
      ];
  return (
    <div aria-hidden="true" className={cn("space-y-3", props.className)}>
      {props.compact ? null : (
        <>
          <SkeletonBlock className="h-36 sm:h-[129px]" />
          <SkeletonBlock className="h-[102px]" />
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map((tile, index) => (
          <SkeletonBlock key={index} className={tile} />
        ))}
      </div>
    </div>
  );
}

/** Section heading placeholder (title plus underline). */
function SkeletonHeading(props: { large?: boolean }) {
  return (
    <div aria-hidden="true" className="space-y-2">
      <SkeletonBlock
        className={cn("w-56 max-w-full", props.large ? "h-10" : "h-8")}
      />
      <SkeletonBlock className="h-[3px] w-10 rounded-full" />
    </div>
  );
}

/** Heading plus `rows` table rows (header row included in the height). */
export function SkeletonTable(props: {
  rows?: number;
  heading?: boolean;
  className?: string;
}) {
  const rows = props.rows ?? 8;
  return (
    <div aria-hidden="true" className={cn("space-y-4", props.className)}>
      {props.heading === false ? null : <SkeletonHeading />}
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="h-9 bg-surface-raised" />
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            className={cn(
              "flex h-11 items-center gap-4 px-3",
              index % 2 === 1 && "bg-row-alt",
            )}
          >
            <SkeletonBlock className="h-4 w-8 rounded" />
            <SkeletonBlock className="h-4 flex-1 rounded" />
            <SkeletonBlock className="h-4 w-12 rounded" />
            <SkeletonBlock className="hidden h-4 w-12 rounded sm:block" />
            <SkeletonBlock className="hidden h-4 w-12 rounded md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Card grid matching the roster card grid. */
export function SkeletonCards(props: { count?: number; className?: string }) {
  const count = props.count ?? 6;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "grid gap-3 md:grid-cols-2 2xl:grid-cols-3",
        props.className,
      )}
    >
      {Array.from({ length: count }, (_, index) => (
        <SkeletonBlock key={index} className="h-32" />
      ))}
    </div>
  );
}

/** Page header (title, subtitle) followed by generic content blocks. */
export function SkeletonPage(props: {
  blocks?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const blocks = props.blocks ?? 3;
  return (
    <div aria-hidden="true" className={cn("space-y-6", props.className)}>
      <div className="space-y-2 border-b border-surface-line pb-6">
        <SkeletonHeading large />
        <SkeletonBlock className="h-5 w-72 max-w-full rounded" />
      </div>
      {props.children}
      {Array.from({ length: props.children ? 0 : blocks }, (_, index) => (
        <SkeletonBlock key={index} className="h-40" />
      ))}
    </div>
  );
}
